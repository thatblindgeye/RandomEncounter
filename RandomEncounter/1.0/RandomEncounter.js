delete state.RandomEncounter;
/**
 * RandomEncounter
 *
 * Version 1.0
 * Last updated: June 25, 2023
 * Author: thatblindgeye
 * GitHub: https://github.com/thatblindgeye
 */

const RandomEncounter = (function () {
  'use strict';

  const VERSION = '1.0';
  const LAST_UPDATED = 1687698220288;
  const RANDOMENCOUNTER_BASE_NAME = 'RandomEncounter';
  const RANDOMENCOUNTER_DISPLAY_NAME = `${RANDOMENCOUNTER_BASE_NAME} v${VERSION}`;

  const DEFAULT_STATE = {
    encounters: {
      Default: [
        {
          description:
            'A random encounter was rolled with [[2d4 + 4]] creatures!',
          uses: undefined,
          id: 'c2xije6i',
        },
      ],
    },
    version: VERSION,
  };
  const COMMANDS = {
    ADD: 'add',
    DELETE: 'delete',
    UPDATE: 'update',
    DISPLAY: 'display',
    ROLL: 'roll',
    IMPORT: 'import',
    EXPORT: 'export',
  };

  const STATUS_STYLING = {
    error: 'rgba(255, 0, 0, 1); background-color: rgba(255, 0, 0, 0.25);',
    warning: 'rgba(255, 127, 0, 1); background-color: rgba(255, 127, 0, 0.25);',
    success: 'rgba(0, 90, 0, 1); background-color: rgba(0, 150, 0, 0.15);',
    generic: 'gray;',
  };

  const PREFIX = '!encounter';
  function macroFactory(macroKey, macroName, createActionCallback) {
    return {
      [macroKey]: {
        name: macroName,
        createAction: createActionCallback,
      },
    };
  }
  const MACROS = {
    ...macroFactory(
      'ADD_CATEGORY_MACRO',
      'RandomEncounter-add-category',
      () => `${PREFIX} ${COMMANDS.ADD}|?{New category name}`
    ),
    ...macroFactory(
      'ADD_ENCOUNTER_MACRO',
      'RandomEncounter-add-encounter',
      () =>
        `${PREFIX} ${COMMANDS.ADD}?{Category to add to|${createCategoriesQuery(
          false
        )}}|?{Encounter(s) to add}`
    ),
    ...macroFactory(
      'DELETE_ENCOUNTER_MACRO',
      'RandomEncounter-delete',
      () =>
        `${PREFIX} ${COMMANDS.DELETE} ?{Categories and/or encounter ID's to delete}`
    ),
    ...macroFactory(
      'UPDATE_ENCOUNTER_MACRO',
      'RandomEncounter-update',
      () => `${PREFIX} ${COMMANDS.UPDATE}|?{Category or encounter ID to update}`
    ),
    ...macroFactory(
      'DISPLAY_ENCOUNTERS_MACRO',
      'RandomEncounter-display',
      () =>
        `${PREFIX} ${
          COMMANDS.DISPLAY
        }?{Categories to display|${createCategoriesQuery()}}`
    ),
    ...macroFactory(
      'ROLL_ENCOUNTER_MACRO',
      'RandomEncounter-roll',
      () =>
        `${PREFIX} ${
          COMMANDS.ROLL
        }?{Categories to roll|${createCategoriesQuery()}}`
    ),
  };

  function createCategoriesQuery(includeAllOption = true) {
    const encountersState = _.has(state, RANDOMENCOUNTER_BASE_NAME)
      ? state[RANDOMENCOUNTER_BASE_NAME].encounters
      : DEFAULT_STATE.encounters;
    const categoryNames = Object.keys(encountersState);

    if (categoryNames.length === 1) {
      return categoryNames[0];
    }

    return `${includeAllOption ? 'ALL CATEGORIES,&#160;|' : ''}${_.map(
      categoryNames,
      (category) => `${category},&#124;${category}`
    ).join('|')}`;
  }

  function getGMPlayers() {
    const playerObjects = findObjs({
      _type: 'player',
    });
    const gmObjects = _.filter(playerObjects, (player) =>
      playerIsGM(player.get('_id'))
    );

    return _.pluck(gmObjects, 'id');
  }

  function getMacroByName(macroName) {
    return findObjs(
      { _type: 'macro', name: macroName },
      { caseInsensitive: true }
    );
  }

  function createMacros() {
    const gmPlayers = getGMPlayers();

    _.each(MACROS, (macro) => {
      const { name, createAction } = macro;
      const existingMacro = getMacroByName(name);

      if (!existingMacro.length) {
        createObj('macro', {
          _playerid: gmPlayers[0],
          name: name,
          action: createAction(),
          visibleto: gmPlayers.join(','),
        });
      }
    });
  }

  function updateMacros() {
    const {
      ADD_ENCOUNTER_MACRO,
      DISPLAY_ENCOUNTERS_MACRO,
      ROLL_ENCOUNTER_MACRO,
    } = MACROS;

    _.each(
      [ADD_ENCOUNTER_MACRO, DISPLAY_ENCOUNTERS_MACRO, ROLL_ENCOUNTER_MACRO],
      (macro) => {
        const { name, createAction } = macro;
        const existingMacro = getMacroByName(name);

        if (existingMacro.length) {
          existingMacro[0].set({ action: createAction() });
        }
      }
    );
  }

  function sendMessage(message, toPlayer, status, noarchive = true) {
    const messagePrefix = toPlayer ? `/w ${toPlayer} ` : '';
    const statusStyling = status ? STATUS_STYLING[status.toLowerCase()] : '';
    const messageStyling = statusStyling
      ? `padding: 8px; border: 1px solid ${statusStyling}`
      : '';
    const messageBlock = `${messagePrefix}<div${
      messageStyling ? ` style="${messageStyling}"` : ''
    }>${message}</div>`;

    sendChat(RANDOMENCOUNTER_DISPLAY_NAME, messageBlock, null, { noarchive });
  }

  function validateAddCommand(commandArgs) {
    const hasInvalidCategoryArg = !commandArgs[0];
    if (hasInvalidCategoryArg) {
      throw new Error(
        `Invalid category name. Category names must be at least 1 character long and cannot be blank.`
      );
    }

    const [categoryName, ...encounterArgs] = _.filter(
      commandArgs,
      (arg) => arg !== ''
    );

    const invalidEncounterArgs =
      commandArgs.length > 1 && !encounterArgs.length;
    if (invalidEncounterArgs) {
      throw new Error(
        `No valid encounters to add. Each encounter must be at least 1 character long and cannot be blank.`
      );
    }

    const stateEncounters = state[RANDOMENCOUNTER_BASE_NAME].encounters;
    const existingCategory =
      _.has(stateEncounters, categoryName) && !encounterArgs.length;
    if (existingCategory) {
      throw new Error(
        `Category <code>${commandArgs[0]}</code> already exists. Category names must be unique when adding a new category.`
      );
    }

    const nonexistantCategory =
      !_.has(stateEncounters, categoryName) && encounterArgs.length;
    if (nonexistantCategory) {
      throw new Error(
        `The encounter category <code>${commandArgs[0]}</code> does not exist. Check that the category is correct, including lettercase and spacing, or add a new category before attempting to add encounters to it.`
      );
    }

    return { category: categoryName, encounters: encounterArgs };
  }

  function validateDeleteCommand(commandArgs) {
    const argsWithoutEmptyStrings = _.filter(commandArgs, (arg) => arg !== '');
    if (!argsWithoutEmptyStrings.length) {
      throw new Error(
        'No valid items to delete. An item cannot be blank and must be either a category name to delete an entire category, or a unique ID of an encounter.'
      );
    }

    const stateEncounters = state[RANDOMENCOUNTER_BASE_NAME].encounters;
    const encounterIDs = _.pluck(
      _.flatten(Object.values(stateEncounters)),
      'id'
    );
    const nonexistantItems = _.filter(
      argsWithoutEmptyStrings,
      (arg) => !_.has(stateEncounters, arg) && !_.contains(encounterIDs, arg)
    );

    if (nonexistantItems.length === argsWithoutEmptyStrings.length) {
      throw new Error(
        'No existing items to delete. Check that the items to delete are correct and already exist.'
      );
    }

    const itemsToDelete = _.difference(
      argsWithoutEmptyStrings,
      nonexistantItems
    );
    const encountersToDelete = [];
    const categoriesToDelete = _.filter(itemsToDelete, (itemToDelete) => {
      const isCategory = _.contains(Object.keys(stateEncounters), itemToDelete);
      if (!isCategory) {
        encountersToDelete.push(itemToDelete);
      }
      return isCategory;
    });

    return {
      categoriesToDelete,
      encountersToDelete,
      nonexistantItems,
    };
  }

  function validateUpdateCommand(commandArgs) {
    const stateEncounters = state[RANDOMENCOUNTER_BASE_NAME].encounters;
    const encounterCategories = Object.keys(stateEncounters);
    const encounterIDs = _.pluck(
      _.flatten(Object.values(stateEncounters)),
      'id'
    );
    const [toUpdate, newValue] = commandArgs;

    if (!toUpdate || !newValue) {
      throw new Error(
        `${!toUpdate ? 'The item to update' : 'The new value'} for the <code>${
          COMMANDS.UPDATE
        }</code> command cannot be blank.`
      );
    }

    if (
      !_.contains(encounterCategories, toUpdate) &&
      !_.contains(encounterIDs, toUpdate)
    ) {
      throw new Error(
        `<code>${toUpdate}</code> does not exist as a category name or encounter ID.`
      );
    }

    if (
      _.contains(encounterCategories, newValue) &&
      !_.contains(encounterIDs, newValue)
    ) {
      throw new Error(
        `<code>${newValue}</code> already exists as a category name. Category names must be unique.`
      );
    }

    if (
      _.contains(encounterIDs, toUpdate) &&
      !/^(\d+|undefined)$/.test(newValue)
    ) {
      throw new Error(
        `<code>${newValue}</code> is not a valid value for encounter uses. You can only pass in an integer or the string <code>undefined</code> for an encounter's amount of uses.`
      );
    }

    return { toUpdate, newValue };
  }

  function validateCategoryNamesArg(commandArgs) {
    const stateCopy = JSON.parse(
      JSON.stringify(state[RANDOMENCOUNTER_BASE_NAME].encounters)
    );

    if (!commandArgs || !commandArgs.length) {
      return { categories: stateCopy };
    }

    const categoryNames = _.filter(commandArgs, (arg) => arg !== '');
    if (!categoryNames.length) {
      throw new Error(
        'No valid category names passed in. Category names cannot be blank.'
      );
    }

    const categoryKeys = Object.keys(stateCopy);
    const invalidCategories = _.filter(
      categoryNames,
      (categoryName) => !_.contains(categoryKeys, categoryName)
    );

    if (invalidCategories.length) {
      throw new Error(
        `<div><div>The following categories could not be found:</div><ul>${_.map(
          invalidCategories,
          (invalidCategory) => `<li>${invalidCategory}</li>`
        ).join(
          ''
        )}</ul><div>Check that all of the categories are correct and exist.</div></div>`
      );
    }

    return { categories: _.pick(stateCopy, ...categoryNames) };
  }

  function validateRollCommand(commandArgs) {
    const initialValidation = validateCategoryNamesArg(commandArgs);
    const rollableEncounters = _.flatten(
      Object.values(initialValidation.categories)
    );

    if (
      _.every(
        rollableEncounters,
        (encounter) => encounter.uses !== undefined && encounter.uses === 0
      )
    ) {
      throw new Error(
        `Unable to roll an encounter as there are no valid encounters with unlimited uses or greater than 0 remaining uses.`
      );
    }

    return initialValidation;
  }

  function validateImportCommand(commandArgs) {
    if (!commandArgs || !commandArgs.length) {
      throw new Error(
        `Failed to import. You must pass in JSON as a parameter, e.g. <code>'{"Category Name": [{"description": "Some text"}]}'</code>.`
      );
    }

    const parsedImport = JSON.parse(commandArgs[0]);
    const checkIsObject = (toCheck) =>
      _.isObject(toCheck) && !_.isArray(toCheck) && !_.isFunction(toCheck);
    const importIsObject = checkIsObject(parsedImport);
    if (!importIsObject) {
      throw new Error(
        `Failed to import. The content passed in must be an object.`
      );
    }

    const importValues = _.values(parsedImport);
    if (_.some(importValues, (importValue) => !_.isArray(importValue))) {
      throw new Error(
        'Failed to import. Each category object must have an array as a value.'
      );
    }

    const flattenedImportedValues = _.flatten(importValues);
    if (
      _.some(
        flattenedImportedValues,
        (importValue) => !checkIsObject(importValue)
      )
    ) {
      throw new Error(
        'Failed to import. Each encounters array within a category must contain only objects.'
      );
    }

    if (
      _.some(
        flattenedImportedValues,
        (importValue) => !_.has(importValue, 'description')
      )
    ) {
      throw new Error(
        'Failed to import. Each encounter object within an encounters array must have a <code>description</code> property.'
      );
    }

    if (
      _.some(
        flattenedImportedValues,
        (importValue) =>
          _.has(importValue, 'uses') && _.isNaN(parseInt(importValue.uses))
      )
    ) {
      throw new Error(
        'Failed to import. When passing in a <code>uses</code> property to an encounter object, it must be an integer.'
      );
    }

    const encountersWithIds = _.filter(
      flattenedImportedValues,
      (importedValue) => _.has(importedValue, 'id')
    );
    const allEncounterIds = _.pluck(encountersWithIds, 'id');
    const uniqueencounterIds = _.uniq(allEncounterIds);
    if (uniqueencounterIds.length < allEncounterIds.length) {
      throw new Error(
        'Failed to import. When passing in an <code>id</code> property to an encounter object, it must be unique across all encounter objects.'
      );
    }

    return { importedEncounters: parsedImport };
  }

  function validateCommands(message) {
    const { ADD, DELETE, UPDATE, DISPLAY, ROLL, IMPORT } = COMMANDS;

    const commandContent = message.content.replace(/!encounter\s*/, '');
    const [command, ...commandArgs] = _.map(
      commandContent.split('|'),
      (content, index) => {
        return index === 0 ? content.toLowerCase().trim() : content.trim();
      }
    );

    const invalidCommand = command && !_.contains(COMMANDS, command);
    if (invalidCommand) {
      throw new Error(
        `<code>${command}</code> is not a valid command. Send <code>!encounter</code> in chat for a list of valid commands.`
      );
    }

    const commandCalledWithoutParameters =
      [ADD, DELETE, UPDATE].includes(command) && !commandArgs.length;
    if (commandCalledWithoutParameters) {
      throw new Error(
        `At least 1 parameter must be passed in when calling the <code>${command}</code> command. Send <code>!encounter</code> in chat to check the expected syntax of each command.`
      );
    }

    if (!command) {
      return command;
    }

    const validators = {
      [ADD]: validateAddCommand,
      [DELETE]: validateDeleteCommand,
      [UPDATE]: validateUpdateCommand,
      [DISPLAY]: validateCategoryNamesArg,
      [ROLL]: validateRollCommand,
      [IMPORT]: validateImportCommand,
    };

    const validatedArgs = validators[command]
      ? validators[command](commandArgs)
      : undefined;
    return { command, commandArgs: validatedArgs };
  }

  const helpRowTemplate = _.template(
    "<tr style='border-bottom: 1px solid gray;'><td style='vertical-align: top; padding: 5px;'><%= commandCell %></td><td style='padding: 5px 5px 5px 10px;'><%= descriptionCell %></td></tr>"
  );

  function buildHelpDisplay() {
    const { ADD, DELETE, UPDATE, DISPLAY, ROLL, IMPORT, EXPORT } = COMMANDS;

    const tableHeader =
      "<thead><tr><th style='padding: 2px;'>Command</th><th style='padding: 2px 2px 2px 10px;'>Description</th></tr></thead>";

    const addEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${ADD}|">Add</a>`,
      descriptionCell: `<div><code>!encounter ${ADD}|[category name]|[vertical pipe separated list of encounters]|[optional number of uses]</code></div><br/><div>Adds a new category when only the <code>category name</code> is passed in, otherwise adds new encounters to the specified category. You must first create a new category before attempting to add encounters to it.<br/><br/><strong>Note:</strong> You cannot use vertical pipes (<code>|</code>) in category names or encounter decriptions.<br/><br/>The <code>number of uses</code> determines how many times an encounter can be rolled. If this argument is omitted then the specified encounters will be able to be rolled an unlimited number of times.<br/><br/>You can add basic styling to your encounter descriptions when they're rolled:<ul><li><code>&#42;Text&#42;</code> will italicize "*Text*"</li><li><code>&#42;&#42;Text&#42;&#42;</code> will bold "**Text**"</li><li>Wrapping a dice roll in double square brackets (<code>&#91;&#91; &#93;&#93;</code>) will calculate the roll, e.g. <code>&#91;&#91;2d6 + 5&#93;&#93;</code></li></ul><br/><br/>Examples:<br/><ul><li><code>!encounter add|Mountains</code> will add a new category named "Mountains"</li><li><code>!encounter add|Mountains|A rockslide occurs|An earth elemental attacks</code> would add 2 new encounters to the "Mountain" category, both with an unlimited amount of uses</li><li><code>!encounter add|Mountains|A rockslide occurs|An earth elemental attacks|5</code> would add 2 new encounters to the "Mountain" category, both with 5 uses</li></ul></div>`,
    });

    const deleteEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${DELETE}|">Delete</a>`,
      descriptionCell: `<div><code>!encounter ${DELETE}|[vertical pipe separated list of categories or encounter IDs]</code></div><br/><div>Deletes the specified categories and/or encounter IDs (case sensitive). For example, <code>!encounter delete|Mountains|ljbkzt9e</code> would delete the entire "Mountains" category as well as the encounter whose id is "ljbkzt9e".</div>`,
    });

    const updateEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${UPDATE}">Update</a>`,
      descriptionCell: `<div><code>!encounter ${UPDATE}|[category name or encounter ID]|[new value]</code></div><br/><div>Updates the category name or encounter uses to the <code>new value</code>. The <code>category name</code> or <code>encounter ID</code> are case sensitive. When updating an encounter, you can only pass in an integer.<br/><br/>Examples:<br/><ul><li><code>!encounter update|Mountains|Northern Mountains</code> would update the category "Mountains" to "Northern Mountains"</li><li><code>!encounter update|ljbkzt9e|5</code> would update the amount of uses for the encounter whose id is "ljbkzt9e" to 5 uses.</li></ul></div>`,
    });

    const displayEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${DISPLAY}">Display</a>`,
      descriptionCell: `<div><code>!encounter ${DISPLAY}|[optional vertical pipe separated list of categories]</code></div><br/><div>Displays all of the encounters for the specified categories (case sensitive), or encounters for all categories if none are provided.<br/><br/>Examples:<br/><ul><li><code>!encounter display|Mountains</code> will display all encounters for the "Mountains" category</li><li><code>!encounter display|Mountains|Swamp</code> will display all encounters for the "Mountains" and "Swamp" categories</li></ul></div>`,
    });

    const rollEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${ROLL}|">Roll</a>`,
      descriptionCell: `<div><code>!encounter ${ROLL}|[optional vertical pipe separated list of categories]</code></div><br/><div>Rolls for a single encounter from the specified category names (case sensitive). If no category names are passed in, an encounter will be rolled from all available categories.<br/><br/>Examples:<br/><ul><li><code>!encounter roll|Mountains</code> will roll an encounter only from the "Mountains" category</li><li><code>!encounter roll|Mountains|Day</code> will roll an encounter from the "Mountains" or "Day" categories</li></ul></div>`,
    });

    const exportCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${EXPORT}|">Export</a>`,
      descriptionCell: `<div><code>!encounter ${EXPORT}</code></div><br/><div>Exports the current encounters state as JSON.</div>`,
    });

    const importCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${IMPORT}|">Import</a>`,
      descriptionCell: `<div><code>!encounter ${IMPORT}|[new encounters state as JSON]</code></div><br/><div>Sets the encounters state to the imported JSON. <span style="font-weight: bold;">This will overwrite the current encounters state and cannot be undone.</span><br/><br/>The JSON must follow the format:<br/><ul><li>An object <code>{}</code> with category names as properties</li><li>Each category name has an array <code>[]</code> as a value</li><li>Each category name array is comprised of encounter objects</li><li>Each encounter object must have a <code>description</code> property</li><li>An encounter object can have optional <code>uses</code> and <code>id</code> properties. <code>id</code> values must be unique across all encounter objects, not just encounter objects in the current category.</li></ul><br/<br/>Examples:<br/><ul><li><code>!encounter import|{ "Category 1": [ { "description": "Sample text" } ] }</code></li><li><code>!encounter import|{ "Category 1": [ { "description": "Sample text", "uses": 5, "id": 12345 } ], "Category 2": [ { "description": "Sample text", "id": 67890 } ] }</code></li></ul></div>`,
    });

    return `<table style="border: 2px solid gray;">${tableHeader}<tbody>${addEncounterCells}${deleteEncounterCells}${updateEncounterCells}${displayEncounterCells}${rollEncounterCells}${exportCells}${importCells}</tbody></table>`;
  }

  let now = Date.now();
  function createUniqueId(arrayToCheck) {
    now = Date.now();
    let id = (now++).toString(36);
    let isIdTaken = _.find(arrayToCheck, (encounter) => encounter.id === id);

    while (isIdTaken) {
      id = (now++).toString(36);
      isIdTaken = _.find(arrayToCheck, (encounter) => encounter.id === id);
    }

    return id;
  }

  function addCategory(categoryName) {
    state[RANDOMENCOUNTER_BASE_NAME].encounters[categoryName] = [];
    sendMessage(
      `<code>${categoryName}</code> category created.`,
      'gm',
      'success'
    );
  }

  function encountersObjectFactory(description, uses, id) {
    return {
      description,
      uses,
      id,
    };
  }

  function createEncounterObjects(encountersArray) {
    const stateEncounters = _.flatten(
      Object.values(state[RANDOMENCOUNTER_BASE_NAME].encounters)
    );
    const lastEncounterItem = encountersArray[encountersArray.length - 1];
    const uses = /^\s*\d+\s*$/.test(lastEncounterItem)
      ? parseInt(lastEncounterItem)
      : undefined;
    const arrayToConvert =
      uses !== undefined
        ? encountersArray.slice(0, encountersArray.length - 1)
        : encountersArray;

    const encountersObjects = [];
    _.each(arrayToConvert, (encounter) => {
      encountersObjects.push(
        encountersObjectFactory(
          encounter,
          uses,
          createUniqueId([...encountersObjects, ...stateEncounters])
        )
      );
    });

    return encountersObjects;
  }

  function addEncounter(categoryName, encountersToAdd) {
    const categoryCopy = JSON.parse(
      JSON.stringify(state[RANDOMENCOUNTER_BASE_NAME].encounters[categoryName])
    );
    const encounterObjects = createEncounterObjects(encountersToAdd);
    const initialUses = encounterObjects[0].uses;

    state[RANDOMENCOUNTER_BASE_NAME].encounters[categoryName] = [
      ...categoryCopy,
      ...encounterObjects,
    ];

    sendMessage(
      `<div>The following encounters were added to the <code>${categoryName}</code> category with ${
        initialUses !== undefined ? `${initialUses} uses` : 'no initial uses'
      }:<div><ul>${_.map(
        encounterObjects,
        (encounter) => `<li>${encounter.description}</li>`
      ).join('')}</ul></div></div>`,
      'gm',
      'success'
    );
  }

  function createDeletionMessage(
    categoriesToDelete,
    encountersToDelete,
    invalidItems
  ) {
    const createDeletionList = (deletionArray) =>
      `<ul>${_.map(deletionArray, (item) => `<li>${item}</li>`).join('')}</ul>`;

    const categoryMessageBlock = categoriesToDelete.length
      ? `The following categories have been deleted:${createDeletionList(
          categoriesToDelete
        )}`
      : '';
    const encounterMessageBlock = encountersToDelete.length
      ? `The following encounter IDs have been deleted:${createDeletionList(
          encountersToDelete
        )}`
      : '';
    const invalidMessageBlock = invalidItems.length
      ? `The following items were not found and could not be deleted:${createDeletionList(
          invalidItems
        )}`
      : '';

    return `<div>${categoryMessageBlock}${encounterMessageBlock}${invalidMessageBlock}</div>`;
  }

  function deleteEncounter(
    categoriesToDelete,
    encountersToDelete,
    invalidItems
  ) {
    const encountersCopy = JSON.parse(
      JSON.stringify(state[RANDOMENCOUNTER_BASE_NAME].encounters)
    );

    const afterCategoryDelete = _.omit(encountersCopy, (_value, key) =>
      categoriesToDelete.includes(key)
    );

    const afterEncounterDelete = {};
    for (const category in afterCategoryDelete) {
      afterEncounterDelete[category] = _.filter(
        afterCategoryDelete[category],
        (encounter) => !encountersToDelete.includes(encounter.id)
      );
    }
    state[RANDOMENCOUNTER_BASE_NAME].encounters = afterEncounterDelete;

    const deletionMessage = createDeletionMessage(
      categoriesToDelete,
      encountersToDelete,
      invalidItems
    );

    sendMessage(
      deletionMessage,
      'gm',
      invalidItems.length ? 'warning' : 'success'
    );
  }

  function updateEncounter(toUpdate, newValue) {
    const encountersCopy = JSON.parse(
      JSON.stringify(state[RANDOMENCOUNTER_BASE_NAME].encounters)
    );
    let message = '';

    if (_.has(encountersCopy, toUpdate)) {
      Object.assign(encountersCopy, { [newValue]: encountersCopy[toUpdate] });
      delete encountersCopy[toUpdate];

      state[RANDOMENCOUNTER_BASE_NAME].encounters = encountersCopy;
      message = `Category <code>${toUpdate}</code> has been renamed to <code>${newValue}</code>`;
      updateMacros();
    }

    const encounterIDs = _.pluck(
      _.flatten(Object.values(encountersCopy)),
      'id'
    );
    if (_.contains(encounterIDs, toUpdate)) {
      state[RANDOMENCOUNTER_BASE_NAME].encounters = _.mapObject(
        encountersCopy,
        (value, key, obj) => {
          const containsId = obj[key].find(
            (encounter) => encounter.id === toUpdate
          );

          if (containsId) {
            return _.map(obj[key], (encounter) => ({
              ...encounter,
              uses: newValue === 'undefined' ? undefined : parseInt(newValue),
            }));
          }

          return value;
        }
      );

      message = `Encounter with ID <code>${toUpdate}</code> has been updated to have ${
        newValue === 'undefined' ? 'unlimited uses' : `${newValue} uses`
      }.`;
    }

    sendMessage(message, 'gm', 'success');
  }

  function createCategoryDisplay(categoryName, encounters) {
    const encountersMarkup = encounters.length
      ? _.map(encounters, (encounter) => {
          const { description, id, uses } = encounter;

          return `<div><div style="line-height: 1.75;">${description}</div><div style="margin-top: 15px;"><div><span style="font-weight: bold;">Remaining Uses:</span> ${
            uses !== undefined ? uses : 'unlimited'
          }</div><div style="margin-top: 5px;"><a href="!encounter delete|${id}">Delete</a></div></div></div>`;
        })
      : '<div>No encounters to display.</div>';

    return `<div style="border: 1px solid gray; padding: 6px 4px;"><h2>${categoryName}</h2><div style="padding: 8px;">${
      encounters.length ? encountersMarkup.join('<hr/>') : encountersMarkup
    }</div></div>`;
  }

  function displayEncounter(categoriesToDisplay) {
    const displayMarkup = _.map(
      categoriesToDisplay,
      (encounters, categoryName) =>
        createCategoryDisplay(categoryName, encounters)
    );

    sendMessage(
      displayMarkup.join('<div style="margin: 20px 0;"></div>'),
      'gm'
    );
  }

  function updateRolledEncounterUses(rolledEncounter) {
    const stateEncounters = state[RANDOMENCOUNTER_BASE_NAME].encounters;
    const categoryRolledFrom = _.findKey(stateEncounters, (encounters) =>
      _.findWhere(encounters, { id: rolledEncounter.id })
    );

    stateEncounters[categoryRolledFrom] = _.map(
      stateEncounters[categoryRolledFrom],
      (encounter) => {
        if (encounter.id === rolledEncounter.id) {
          return { ...encounter, uses: encounter.uses - 1 };
        }

        return encounter;
      }
    );
  }

  function rollEncounter(categoriesToRoll) {
    const rollableEncounters = _.filter(
      _.flatten(Object.values(categoriesToRoll)),
      (encounter) => encounter.uses === undefined || encounter.uses > 0
    );
    const rolledEncounter =
      rollableEncounters[_.random(rollableEncounters.length - 1)];

    if (rolledEncounter.uses !== undefined) {
      updateRolledEncounterUses(rolledEncounter);
    }

    sendMessage(
      `<div style="line-height: 1.75;">${rolledEncounter.description}</div>`,
      'gm',
      'generic'
    );
  }

  function importEncounters(importedJSON) {
    const importedState = {};
    for (const category in importedJSON) {
      importedState[category] = [];
      _.each(importedJSON[category], (importedEncounter) => {
        if (!importedEncounter.id) {
          importedState[category].push({
            ...importedEncounter,
            id: createUniqueId(_.flatten(Object.values(importedState))),
          });
        }

        if (importedEncounter.id) {
          importedState[category].push(importedEncounter);
        }
      });
    }

    state[RANDOMENCOUNTER_BASE_NAME].encounters = importedState;
    sendMessage(
      `Imported new ${RANDOMENCOUNTER_BASE_NAME} state successfully.`,
      'gm',
      'success'
    );
  }

  function handleChatInput(message) {
    try {
      const { ADD, DELETE, UPDATE, DISPLAY, ROLL, IMPORT, EXPORT } = COMMANDS;

      const { command, commandArgs } = validateCommands(message);

      switch (command) {
        case ADD:
          const { category, encounters } = commandArgs;

          if (encounters.length) {
            addEncounter(category, encounters);
          } else {
            addCategory(category);
            updateMacros();
          }
          break;
        case DELETE:
          const { categoriesToDelete, encountersToDelete, nonexistantItems } =
            commandArgs;

          deleteEncounter(
            categoriesToDelete,
            encountersToDelete,
            nonexistantItems
          );

          if (categoriesToDelete.length) {
            updateMacros();
          }
          break;
        case UPDATE:
          const { toUpdate, newValue } = commandArgs;

          updateEncounter(toUpdate, newValue);
          break;
        case DISPLAY:
        case ROLL:
          const { categories } = commandArgs;
          const commandFunction = {
            [DISPLAY]: displayEncounter,
            [ROLL]: rollEncounter,
          };

          commandFunction[command](categories);

          break;
        case IMPORT:
          const { importedEncounters } = commandArgs;
          importEncounters(importedEncounters);
          break;
        case EXPORT:
          sendMessage(
            `<code>'${JSON.stringify(
              state[RANDOMENCOUNTER_BASE_NAME].encounters
            )}'</code>`
          );
          break;
        default:
          sendMessage(buildHelpDisplay(), 'gm');
          break;
      }
    } catch (error) {
      sendMessage(`${error.message}`, 'gm', 'error');
    }
  }

  function registerEventHandlers() {
    on('chat:message', (message) => {
      if (message.type === 'api' && /^!encounter/i.test(message.content)) {
        handleChatInput(message);
      }
    });
  }

  function checkInstall() {
    if (!_.has(state, RANDOMENCOUNTER_BASE_NAME)) {
      log('Installing ' + RANDOMENCOUNTER_DISPLAY_NAME);
      state[RANDOMENCOUNTER_BASE_NAME] = JSON.parse(
        JSON.stringify(DEFAULT_STATE)
      );

      createMacros();
      log('RandomEncounter macros created...');
    }

    log(
      `${RANDOMENCOUNTER_DISPLAY_NAME} installed. Last updated ${new Date(
        LAST_UPDATED
      ).toLocaleDateString('en-US', {
        dateStyle: 'long',
      })}. Send the '!encounter' command (without quotes) in chat for a list of valid commands.`
    );
  }

  return {
    checkInstall,
    registerEventHandlers,
  };
})();

on('ready', () => {
  'use strict';

  RandomEncounter.checkInstall();
  RandomEncounter.registerEventHandlers();
});
