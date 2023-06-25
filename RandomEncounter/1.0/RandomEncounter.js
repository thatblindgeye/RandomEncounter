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
  const COMMANDS = {
    ADD_ENCOUNTER: 'add',
    DELETE_ENCOUNTER: 'delete',
    UPDATE_ENCOUNTER: 'update',
    DISPLAY_ENCOUNTERS: 'display',
    ROLL_ENCOUNTER: 'roll',
  };

  const STATUS_STYLING = {
    error: 'rgba(255, 0, 0, 1); background-color: rgba(255, 0, 0, 0.25);',
    warning: 'rgba(255, 127, 0, 1); background-color: rgba(255, 127, 0, 0.25);',
    success: 'rgba(0, 90, 0, 1); background-color: rgba(0, 150, 0, 0.15);',
    generic: 'gray;',
  };

  const PREFIX = '!encounter';
  const MACROS = {
    ADD_ENCOUNTER_MACRO: {
      name: 'RandomEncounter-add',
      action: `${PREFIX} ${COMMANDS.ADD_ENCOUNTER}`,
    },
    DELETE_ENCOUNTER_MACRO: {
      name: 'RandomEncounter-delete',
      action: `${PREFIX} ${COMMANDS.DELETE_ENCOUNTER} ?{Encounter ID to delete}`,
    },
    UPDATE_ENCOUNTER_MACRO: {
      name: 'RandomEncounter-set',
      action: `${PREFIX} ${COMMANDS.UPDATE_ENCOUNTER}`,
    },
    DISPLAY_ENCOUNTERS_MACRO: {
      name: 'RandomEncounter-display',
      action: `${PREFIX} ${COMMANDS.DISPLAY_ENCOUNTERS}`,
    },
    ROLL_ENCOUNTER_MACRO: {
      name: 'RandomEncounter-roll',
      action: `${PREFIX} ${COMMANDS.ROLL_ENCOUNTER}`,
    },
  };

  const DEFAULT_STATE = {
    encounters: {
      'Default Category': [
        {
          description:
            'A random encounter was rolled with [[2d4 + 4]] creatures!',
          uses: 2,
          id: 'c2xije6i',
        },
      ],
    },
    version: VERSION,
  };

  function createMacros() {
    const gmPlayers = _.pluck(
      _.filter(
        findObjs({
          _type: 'player',
        }),
        (player) => playerIsGM(player.get('_id'))
      ),
      'id'
    );

    _.each(MACROS, (macro) => {
      const { name, action } = macro;
      const existingMacro = findObjs(
        { _type: 'macro', name },
        { caseInsensitive: true }
      );

      if (!existingMacro.length) {
        createObj('macro', {
          _playerid: gmPlayers[0],
          name: name,
          action: action,
          visibleto: gmPlayers.join(','),
        });
      }
    });
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

  function validateAddEncounterCommand(commandArgs) {
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

  function validateDeleteEncounterCommand(commandArgs) {
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

  function validateUpdateEncounterCommand(commandArgs) {
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
          COMMANDS.UPDATE_ENCOUNTER
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

  function validateRollEncounterCommand(commandArgs) {
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

  function validateCommands(message) {
    const {
      ADD_ENCOUNTER,
      DELETE_ENCOUNTER,
      UPDATE_ENCOUNTER,
      DISPLAY_ENCOUNTERS,
      ROLL_ENCOUNTER,
    } = COMMANDS;

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
      [ADD_ENCOUNTER, DELETE_ENCOUNTER, UPDATE_ENCOUNTER].includes(command) &&
      !commandArgs.length;
    if (commandCalledWithoutParameters) {
      throw new Error(
        `At least 1 parameter must be passed in when calling the <code>${command}</code> command. Send <code>!encounter</code> in chat to check the expected syntax of each command.`
      );
    }

    if (!command) {
      return command;
    }

    const validators = {
      [ADD_ENCOUNTER]: validateAddEncounterCommand,
      [DELETE_ENCOUNTER]: validateDeleteEncounterCommand,
      [UPDATE_ENCOUNTER]: validateUpdateEncounterCommand,
      [DISPLAY_ENCOUNTERS]: validateCategoryNamesArg,
      [ROLL_ENCOUNTER]: validateRollEncounterCommand,
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
    const {
      ADD_ENCOUNTER,
      DELETE_ENCOUNTER,
      UPDATE_ENCOUNTER,
      DISPLAY_ENCOUNTERS,
      ROLL_ENCOUNTER,
    } = COMMANDS;

    const tableHeader =
      "<thead><tr><th style='padding: 2px;'>Command</th><th style='padding: 2px 2px 2px 10px;'>Description</th></tr></thead>";

    const addEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${ADD_ENCOUNTER}|">Add Encounter</a>`,
      descriptionCell: `<div><code>!encounter ${ADD_ENCOUNTER}|</code></div><br/><div></div>`,
    });

    const deleteEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${DELETE_ENCOUNTER}|">Delete Encounter</a>`,
      descriptionCell: `<div><code>!encounter ${DELETE_ENCOUNTER}|</code></div><br/><div></div>`,
    });

    const setEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${UPDATE_ENCOUNTER}">Update Encounter</a>`,
      descriptionCell: `<div><code>!encounter ${UPDATE_ENCOUNTER}</code></div><br/><div></div>`,
    });

    const displayEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${DISPLAY_ENCOUNTERS}">Display Encounters</a>`,
      descriptionCell: `<div><code>!encounter ${DISPLAY_ENCOUNTERS}</code></div><br/><div></div>`,
    });

    const rollEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${ROLL_ENCOUNTER}|">Roll Encounter</a>`,
      descriptionCell: `<div><code>!encounter ${ROLL_ENCOUNTER}|</code></div><br/><div></div>`,
    });

    return `<table style="border: 2px solid gray;">${tableHeader}<tbody>${addEncounterCells}${deleteEncounterCells}${setEncounterCells}${displayEncounterCells}${rollEncounterCells}</tbody></table>`;
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

  function handleChatInput(message) {
    try {
      const {
        ADD_ENCOUNTER,
        DELETE_ENCOUNTER,
        UPDATE_ENCOUNTER,
        DISPLAY_ENCOUNTERS,
        ROLL_ENCOUNTER,
      } = COMMANDS;

      const { command, commandArgs } = validateCommands(message);

      switch (command) {
        case ADD_ENCOUNTER:
          const { category, encounters } = commandArgs;

          if (encounters.length) {
            addEncounter(category, encounters);
          } else {
            addCategory(category);
          }
          break;
        case DELETE_ENCOUNTER:
          const { categoriesToDelete, encountersToDelete, nonexistantItems } =
            commandArgs;

          deleteEncounter(
            categoriesToDelete,
            encountersToDelete,
            nonexistantItems
          );
          break;
        case UPDATE_ENCOUNTER:
          const { toUpdate, newValue } = commandArgs;

          updateEncounter(toUpdate, newValue);
          break;
        case DISPLAY_ENCOUNTERS:
        case ROLL_ENCOUNTER:
          const { categories } = commandArgs;

          if (command === DISPLAY_ENCOUNTERS) {
            displayEncounter(categories);
          } else {
            rollEncounter(categories);
          }

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
    if (!_.has(state, 'RandomEncounter')) {
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
