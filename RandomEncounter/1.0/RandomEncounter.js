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
  const LAST_UPDATED = 1686511846334;
  const RANDOMENCOUNTER_BASE_NAME = 'RandomEncounter';
  const RANDOMENCOUNTER_DISPLAY_NAME = `${RANDOMENCOUNTER_BASE_NAME} v${VERSION}`;
  const COMMANDS = {
    ADD_ENCOUNTER: 'add',
    DELETE_ENCOUNTER: 'delete',
    SET_ENCOUNTER: 'set',
    DISPLAY_ENCOUNTERS: 'display',
    ROLL_ENCOUNTER: 'roll',
  };

  const REGEX = {
    ADD_ENCOUNTERS_FORMAT: /\[".+?"\](=\d*)?/,
    ADD_ENCOUNTER_SINGLE: /".+?"/g,
    ADD_ENCOUNTER_USES: /(?<=\=)\d*$/,
    ADD_CATEGORY: /(?<!\[).+?(?=\[)(?!\])/,
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
    SET_ENCOUNTER_MACRO: {
      name: 'RandomEncounter-set',
      action: `${PREFIX} ${COMMANDS.SET_ENCOUNTER}`,
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
          id: 0,
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

  function sendMessage(message, noarchive = true) {
    sendChat(RANDOMENCOUNTER_DISPLAY_NAME, message, null, { noarchive });
  }

  function validateCommand(message) {
    const {
      ADD_ENCOUNTER,
      DELETE_ENCOUNTER,
      SET_ENCOUNTER,
      DISPLAY_ENCOUNTERS,
      ROLL_ENCOUNTER,
    } = COMMANDS;

    const commandContent = message.content.replace(/!encounter\s*/);
    const [command, ...commandArgs] = _.map(
      commandContent.split('|'),
      (content, index) => {
        if (index === 0) {
          return content.toLowerCase();
        }

        return content;
      }
    );

    if (command && !_.contains(COMMANDS, command)) {
      throw new Error(
        `<code>${command}</code> is not a valid command. Send <code>!encounter</code> in chat for a list of valid commands.`
      );
    }

    return [command, ...commandArgs];
  }

  const helpRowTemplate = _.template(
    "<tr style='border-bottom: 1px solid gray;'><td style='vertical-align: top; padding: 5px;'><%= commandCell %></td><td style='padding: 5px 5px 5px 10px;'><%= descriptionCell %></td></tr>"
  );

  function buildHelpDisplay() {
    const {
      ADD_ENCOUNTER,
      DELETE_ENCOUNTER,
      SET_ENCOUNTER,
      DISPLAY_ENCOUNTERS,
      ROLL_ENCOUNTER,
    } = COMMANDS;

    const tableHeader =
      "<thead><tr><th style='padding: 2px;'>Command</th><th style='padding: 2px 2px 2px 10px;'>Description</th></tr></thead>";

    const addEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${ADD_ENCOUNTER}|">Add Encounter</a>`,
      descriptionCell: `<div><code>!encounter ${ADD_ENCOUNTER}|</code></div><br/><div>></div>`,
    });

    const deleteEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${DELETE_ENCOUNTER}|">Delete Encounter</a>`,
      descriptionCell: `<div><code>!encounter ${DELETE_ENCOUNTER}|</code></div><br/><div></div>`,
    });

    const setEncounterCells = helpRowTemplate({
      commandCell: `<a href="!encounter ${SET_ENCOUNTER}">Set Encounter</a>`,
      descriptionCell: `<div><code>!encounter ${SET_ENCOUNTER}</code></div><br/><div></div>`,
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

  function splitEncounterString(encounterString) {
    const { ADD_ENCOUNTERS_FORMAT, ADD_ENCOUNTER_SINGLE, ADD_ENCOUNTER_USES } =
      REGEX;
    const encounterArrays = encounterString.match(
      new RegExp(ADD_ENCOUNTERS_FORMAT, 'g')
    );

    if (!encounterArrays) {
      throw new Error(
        'The format of the passed in encounter(s) was incorrect. When passing in a list of encounters to add, you must use the format <code>[<comma separated list of encounters wrapped in quotes>]<=optional uses></code> for each set of encounters, e.g. <code>["An encounter description", "Another encounter description"]=2 ["Encounter in a different set"]</code>.'
      );
    }

    return encounterArrays.map((encounterArray) => {
      const descriptions = _.map(
        encounterArray.match(ADD_ENCOUNTER_SINGLE),
        (desc) => desc.replace(/"/g, '')
      );
      const usesIndex = encounterArray.search(ADD_ENCOUNTER_USES);

      return {
        descriptions,
        uses:
          usesIndex !== -1
            ? parseInt(encounterArray.slice(usesIndex))
            : undefined,
      };
    });
  }

  let now = Date.now();
  function createUniqueId(arrayToCheck) {
    let id = (now++).toString(36);
    let isIdTaken = _.find(arrayToCheck, (encounter) => encounter.id === id);

    while (isIdTaken) {
      id = (now++).toString(36);
      isIdTaken = _.find(stateEncounters, (encounter) => encounter.id === id);
    }

    return id;
  }

  function createEncounterObject(description, uses, id) {
    return {
      description,
      uses,
      id,
    };
  }

  function convertEncountersArrayItems(encountersArray) {
    const stateEncounters = Object.values(
      state[RANDOMENCOUNTER_BASE_NAME].encounters
    ).flat();
    const encountersObjects = _.map(encountersArray, (encounter) => {
      const { descriptions, uses } = encounter;

      return _.map(descriptions, (description) =>
        createEncounterObject(
          description,
          uses,
          createUniqueId(stateEncounters)
        )
      );
    });

    return encountersObjects.flat();
  }

  function addEncounter(category, encounterString) {
    if (!_.has(state[RANDOMENCOUNTER_BASE_NAME].encounters, category)) {
      throw new Error(
        `The encounter category <code>${category}</code> does not exist. Check that the category is correct or add a new category before attempting to add encounters to it.`
      );
    }

    const categoryCopy = state[RANDOMENCOUNTER_BASE_NAME].encounters[category];
    const encountersArray = splitEncounterString(encounterString);
    const encountersObjects = convertEncountersArrayItems(encountersArray);
  }

  function handleChatInput(message) {
    try {
      const {
        ADD_ENCOUNTER,
        DELETE_ENCOUNTER,
        SET_ENCOUNTER,
        DISPLAY_ENCOUNTERS,
        ROLL_ENCOUNTER,
      } = COMMANDS;

      const [command, ...commandArgs] = validateCommand(message);

      switch (command) {
        case ADD_ENCOUNTER:
          break;
        case DELETE_ENCOUNTER:
          break;
        case SET_ENCOUNTER:
          break;
        case DISPLAY_ENCOUNTERS:
          break;
        case ROLL_ENCOUNTER:
          break;
        default:
          buildHelpDisplay();
          break;
      }
    } catch (error) {
      sendMessage(`/w gm ${error.message}`);
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
