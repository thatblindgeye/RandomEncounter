delete state.RandomEncounter;
/**
 * RandomEncounter
 *
 * Version 1.0
 * Last updated: June 10, 2023
 * Author: thatblindgeye
 * GitHub: https://github.com/thatblindgeye
 */

const RandomEncounter = (function () {
  'use strict';

  const VERSION = '1.0';
  const LAST_UPDATED = 1687013941553;
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
          uses: undefined,
          id: '00000000',
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
    const encounterIDs = _.pluck(Object.values(stateEncounters).flat(), 'id');
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

    let validatedArgs;
    if (command === ADD_ENCOUNTER) {
      validatedArgs = validateAddEncounterCommand(commandArgs);
    }
    if (command === DELETE_ENCOUNTER) {
      validatedArgs = validateDeleteEncounterCommand(commandArgs);
    }

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
    const stateEncounters = Object.values(
      state[RANDOMENCOUNTER_BASE_NAME].encounters
    ).flat();
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
          break;
        case DISPLAY_ENCOUNTERS:
          break;
        case ROLL_ENCOUNTER:
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
