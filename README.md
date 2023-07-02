# RandomEncounter

Thank you for installing RandomEncounter! To suggest features or to report bugs, please create an issue at my [RandomEncounter repo](https://github.com/thatblindgeye/RandomEncounter).

The purpose of this script is to store the various random encounters that can occur in a campaign. Unlike rollable tables, RandomEncounter can:

- Store all encounters in different categories in one place
- Roll a random encounter from a single category or multiple categories with ease
- Create encounters that have limited or unlimited uses, with the amount of uses updating automatically
- Support inline rolls and basic Markdown styling for bold and italics in encounter descriptions

## Basic Syntax

In order to use a RandomEncounter command, you must use the following syntax:

`!encounter <keyword>|<vertial pipe separated list of args>`

- **`!encounter`**: This must preface a RandomEncounter command in order to call it.
- **`<keyword>`** This is the primary command keyword which determines what command will be called. If no keyword is passed in a help table will be displayed, describing each command that can be called.
- **`<vertial pipe separated list of args>`** This is the list of arguments passed to a command.

## Commands List

The following commands are available for use. Macros for commands will be created when first installing the script, and some will update automatically when the RandomEncounter state is updated.

Due to how commands are split, you cannot use vertical pipes (`|`) in the parameter content passed into a command.

### Add

`!encounter add|<category name>|<vertical pipe separated list of encounters>|<optional amount of uses for encounter(s)>`

If only the `category name` is passed in, e.g. `!encounter add|New Category`, a new category will be created. Category names must be unique. You must create a new category before attempting to add any encounters to it.

You can add multiple encounters to a category at once by separating each with a vertical pipe, e.g. `!encounter add|New Category|Encounter text one|Encounter text two`.

The amount of uses an encounter has determines whether the encounter can be randomly chosen or not. By default any encounters added will be added with unlimited uses. If you want encounters added with only a certain amount of uses you can pass an integer as the last parameter to the command. For example, `!encounter add|New Category|Encounter text one|Encounter text two|5` would add two encounters, each with 5 uses.

When adding encounters to a category, you can utilize basic Markdown styling as well as create inline rolls:

- Text wrapped in one asterisk `*text*` will italicize text
- Text wrapped in two asterisks `**text**` will bold text
- Text wrapped in three asterisks `***text***` will italicize and bold text
- A roll wrapped in double square brackets `[[2d4 + 5]]` will output the roll result

### Delete

`!encounter delete|<vertical pipe separated list of category names and/or encounter IDs>`

Deletes the specified items from the RandomEncounter state. Category names and encounter IDs are case sensitive and must match exactly as they are in the RandomEncounter state.

### Update

`!encounter update|<category name or encounter ID to update>|<new value>`

Updates the category name or the amount of uses for an encounter ID. The category name or encounter ID are case sensitive and have the same restrictions as adding an encounter.

### Display

`!encounter display|<optional vertical pipe separated list of categories>`

Displays the current encounters in chat. If any valid category names are passed in as parameters, only encounters in those categories will be displayed. Otherwise all encounters will be displayed.

### Roll

`!encounter roll|<optional vertical pipe separated list of categories>`

Rolls for a random encounter. If any valid category names are passed in as parameters, an encounter will be rolled from one of those categories. Otherwise an encounter will be rolled from any category.

### Export

`!encounter export`

Exports the current RandomEncounter state as JSON.

### Import

`!encounter import|<JSON>`

Imports the passed in JSON and sets the RandomEncounter state. This will overwrite the current state and cannot be undone.
