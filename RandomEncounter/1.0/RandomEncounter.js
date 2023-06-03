/**
 * RandomEncounter
 *
 * Version 1.0
 * Last updated: May 30, 2023
 * Author: thatblindgeye
 * GitHub: https://github.com/thatblindgeye
 */

const RandomEncounter = (function () {
  'use strict';

  const VERSION = '1.0';
  const LAST_UPDATED = 1685487612396;
  const RANDOMENCOUNTER_BASE_NAME = 'RandomEncounter';
  const RANDOMENCOUNTER_DISPLAY_NAME = `${DURATION_BASE_NAME} v${VERSION}`;
  const COMMANDS = {
    ADD_ENCOUNTER: 'add',
    DELETE_ENCOUNTER: 'delete',
    SET_ENCOUNTER: 'set',
    DISPLAY_ENCOUNTERS: 'display',
    ROLL_ENCOUNTER: 'roll',
    CONFIG: 'config',
  };

  const CONFIG_SETTINGS = {
    ENCOUNTER_ROLLTYPE: 'rolltype',
    ENCOUNTER_RANGE: 'range',
  };

  const PREFIX = '!encounter ';
  const MACROS = {
    ADD_ENCOUNTER_MACRO: {
      name: 'RandomEncounter-add',
      action: `${PREFIX} ${COMMANDS.ADD_ENCOUNTER}`,
    },
    DELETE_ENCOUNTER_MACRO: {
      name: 'RandomEncounter-delete',
      action: `${PREFIX} ${COMMANDS.DELETE_ENCOUNTER}`,
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
    CONFIG_MACRO: {
      name: 'RandomEncounter-config',
      action: `${PREFIX} ${COMMANDS.CONFIG}`,
    },
  };

  const DEFAULT_STATE = {
    encounters: {
      'Default Category': [],
    },
    config: {
      rolltype: '1d20',
      range: '20',
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

  function sendMessage(message) {
    sendChat(RANDOMENCOUNTER_DISPLAY_NAME, message, null, { noarchive: true });
  }

  function validateCommand(message) {
    const {
      ADD_ENCOUNTER,
      DELETE_ENCOUNTER,
      SET_ENCOUNTER,
      DISPLAY_ENCOUNTERS,
      ROLL_ENCOUNTER,
      CONFIG,
    } = COMMANDS;
    const { ENCOUNTER_ROLLTYPE, ENCOUNTER_RANGE } = CONFIG_SETTINGS;

    const [prefix, ...options] = message.content.split('|');
    const command = _.map(prefix.split(' '), (prefixItem) =>
      prefixItem.toLowerCase()
    )[1];

    if (command && !_.contains(COMMANDS, command)) {
      throw new Error(
        `<code>${command}</code> is not a valid command. Send <code>!encounter</code> in chat for a list of valid commands.`
      );
    }

    return [command, ...options];
  }

  const configRowTemplate = _.template(
    "<tr style='border-bottom: 1px solid gray;'><td style='vertical-align: top; padding: 5px;'><%= commandCell %></td><td style='padding: 5px 5px 5px 10px;'><%= descriptionCell %></td></tr>"
  );

  function buildConfigDisplay() {
    const {
      ADD_DURATION,
      ADD_GM_DURATION,
      SHOW_GM_DURATIONS,
      CLEAR,
      SORT,
      CONFIG,
    } = COMMANDS;
    const { ROUND_DISPLAY_NAME, AUTO_CLEAR, AUTO_DELETE } = CONFIG_SETTINGS;
    const { roundDisplayName, autoClearTurnorder, autoDeleteDurations } =
      state[DURATION_BASE_NAME];

    const tableHeader =
      "<thead><tr><th style='padding: 2px;'>Command</th><th style='padding: 2px 2px 2px 10px;'>Description</th></tr></thead>";

    const addDurationCells = configRowTemplate({
      commandCell: `<a href="!durations ${ADD_DURATION}|?{Duration name}|?{Duration length - must be an integer}|?{Insert at initiative - must be an integer or decimal}">Add Duration</a>`,
      descriptionCell: `<div><code>!durations ${ADD_DURATION}|[duration name]|[duration length]|[initiative]</code></div><br/><div>Adds a duration to the Roll20 turn tracker, visible to all players in the game. The turnorder is automatically sorted after adding a duration.</div><br/><div>This command accepts the following arguments when called: <ul><li><span style="font-weight: bold;">Name:</span> the name of the item that will appear in the turnorder.</li><li><span style="font-weight: bold;">Length:</span> how long the duration will last for.</li><li><span style="font-weight: bold;">Initiative:</span> where in the turnorder the duration will be placed. This argument defaults to an initiative of <code>0</code> when a value is not passed in.</li></ul></div>`,
    });

    const addGMDurationCells = configRowTemplate({
      commandCell: `<a href="!durations ${ADD_GM_DURATION}|?{GM duration description}|?{GM duration length - must be an integer}">Add GM Duration</a>`,
      descriptionCell: `<div><code>!durations ${ADD_GM_DURATION}|[GM duration description]|[GM duration length - must be an integer]</code></div><br/><div>Adds a private duration that can be seen only by the GM. All GM durations appear in the Roll20 chat when shown, which occurs at the start of each round or when the <code>!durations ${SHOW_GM_DURATIONS}</code> command is called.</div><br/><div>This command accepts the following arguments when called: <ul><li><span style="font-weight: bold;">Description:</span> a description of the GM duration, which can be more detailed than a public duration in the turn tracker.</li><li><span style="font-weight: bold;">Length:</span> how long the GM duration will last. The length of a GM duration will decrease by 1 at the start of each round.</li></ul></div>`,
    });

    const showGMDurationsCells = configRowTemplate({
      commandCell: `<a href="!durations ${SHOW_GM_DURATIONS}">Show GM Durations</a>`,
      descriptionCell: `<div><code>!durations ${SHOW_GM_DURATIONS}</code></div><br/>Shows the current GM durations as a whisper to the GM.`,
    });

    const clearDurationsCells = configRowTemplate({
      commandCell: `<a href="!durations ${CLEAR}">Clear Turnorder</a>`,
      descriptionCell: `<div><code>!durations ${CLEAR}</code></div><br/>Clears the turnorder and deletes all GM durations.`,
    });

    const sortDurationsCells = configRowTemplate({
      commandCell: `<a href="!durations ${SORT}|?{Starting round - must be an integer|1}|?{Round formula - must be "+" or "-" followed by an integer|+1}|?{Sort order|Ascending|Descending}">Sort Turnorder</a>`,
      descriptionCell: `<div><code>!durations ${SORT}|[starting round]|[round formula]|[sort order]</code></div><br/><div>Sorts the turnorder, retaining the current turn.</div><br/><div>This command accepts the following arguments: <ul><li><span style="font-weight: bold;">Starting round:</span> the round number to start at when the turnorder is sorted for the first time after being cleared. This argument defaults to <code>1</code> when a value is not passed in.</li><li><span style="font-weight: bold;">Round formula:</span> the formula for adjusting the round number on each initiative pass. The value passed in must start with either a plus <code>+</code> or minus <code>-</code> sign, followed by a number. This argument defaults to a formula of <code>+1</code> when a value is not passed in.</li><li><span style="font-weight: bold;">Sort order:</span> determines what order to sort the turnorder in, and must be either <code>ascending</code> (lowest to highest) or <code>descending</code> (highest to lowest). This argument defaults to <code>descending</code> when a value is not passed in.</li></ul></div>`,
    });

    const roundNameCells = configRowTemplate({
      commandCell: `<a href="!durations ${CONFIG}|${ROUND_DISPLAY_NAME}|?{Round display name}">Round Display Name</a><div>Current setting: <code>${roundDisplayName}</code></div>`,
      descriptionCell: `<div><code>!durations ${CONFIG}|${ROUND_DISPLAY_NAME}|[new display name]</code></div><br/><div>The display name of the round item in the turnorder.</div><br/><div>When calling this command, lettercase must be retained for the <code>${ROUND_DISPLAY_NAME}</code> config setting in the command call.</div>`,
    });

    const autoClearCells = configRowTemplate({
      commandCell: `<a href="!durations ${CONFIG}|${AUTO_CLEAR}|${
        autoClearTurnorder ? 'false' : 'true'
      }">Auto Clear Turnorder</a><div>Current setting: <code>${
        autoClearTurnorder ? 'Enabled' : 'Disabled'
      }</code></div>`,
      descriptionCell: `<div><code>!durations ${CONFIG}|${AUTO_CLEAR}|[true or false]</code></div><br/><div>When this config setting is enabled, the turnorder will be cleared and all GM durations will be deleted whenever the turnorder is opened.</div><br/><div>When calling this command, lettercase must be retained for the <code>${AUTO_CLEAR}</code> config setting in the command call.</div>`,
    });

    const autoDeleteCells = configRowTemplate({
      commandCell: `<a href="!durations ${CONFIG}|${AUTO_DELETE}|${
        autoDeleteDurations ? 'false' : 'true'
      }">Auto Delete Durations</a><div>Current setting: <code>${
        autoDeleteDurations ? 'Enabled' : 'Disabled'
      }</code></div>`,
      descriptionCell: `<div><code>!durations ${CONFIG}|${AUTO_DELETE}|[true or false]</code></div><br/><div>When enabled, any durations or GM durations that reach a length of 0 or less will automatically be deleted. Public durations in the turnorder are deleted when the turnorder is advanced and the duration is last in the turnorder. GM durations are deleted at the start of each round.</div><br/><div>When calling this command, lettercase must be retained for the <code>${AUTO_DELETE}</code> config setting in the command call.</div>`,
    });

    return `<table style="border: 2px solid gray;">${tableHeader}<tbody>${addDurationCells}${addGMDurationCells}${showGMDurationsCells}${clearDurationsCells}${sortDurationsCells}${roundNameCells}${autoClearCells}${autoDeleteCells}</tbody></table>`;
  }

  function handleChatInput(message) {
    try {
      const {
        ADD_ENCOUNTER,
        DELETE_ENCOUNTER,
        SET_ENCOUNTER,
        DISPLAY_ENCOUNTERS,
        ROLL_ENCOUNTER,
        CONFIG,
      } = COMMANDS;

      const [command, ...options] = validateCommand(message);

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
        case CONFIG:
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
