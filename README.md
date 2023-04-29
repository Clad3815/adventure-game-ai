# Adventure Game Generator

Adventure Game Generator is a text-based game creation tool that allows you to generate your own interactive adventure games using the power of OpenAI. This project relies on the [ai-function-helper](https://github.com/Clad3815/ai-function-helper/) library to generate game content and handle player choices.

This project has been tested with `gpt3.5-turbo` and is expected to return better results with `gpt4` model.

## Features

- Customizable game settings, including language, environment, and difficulty: Set your own game parameters and see how the game evolves.
- Auto translate menu language to the game language if wanted: Ensures a seamless gaming experience in your chosen language.
- Dynamic player class generation based on character description and player sex: Allows for a more personalized gaming experience.
- Automatic player attribute generation based on player details and game settings: Your player's attributes will dynamically change based on your inputs and game settings.
- Continuous gameplay with generated narrative and choices: The game continues indefinitely, providing new narratives and choices for an engaging experience.
- Inventory management: Manage your player's inventory throughout the game.
- Automatic location generation: New locations are automatically generated, keeping the game fresh and exciting.
- Automatic quest management: Quests are automatically managed for continuous gameplay.
- Automatic player stats management: Player stats are tracked and updated automatically.
- Auto save game: Don't worry about losing your progress, the game auto-saves.

And much more! Explore the game to discover all its features.


## Todo

- [x] Make multiple prompt `game-multi-prompt.js` instead of one large one to avoid confusion for `gpt3.5-turbo`
- [x] Manage each data individually to avoid confusion for `gpt3.5-turbo` (ex: `inventory` and `location`)
- [ ] Add `gpt4` support instead of editing `generateNarrativeText` function manually
- [ ] Generate a complete game scenario from start to end to follow a storyline.
- [ ] Generate a main quest to the game
- [ ] Add sub-quest system
- [ ] Improve save and load system: Add support for multiple save slots or an autosave feature.
- [ ] Enhanced player customization: Allow for more nuanced character customization, such as choosing a backstory or specific skill sets.
- [ ] Add NPC interaction: Include non-player characters (NPCs) that players can interact with, such as merchants, quest givers, or potential party members.
- [ ] Implement a more complex combat system: Add different types of attacks, defense mechanisms, or even a magic system.
- [ ] Create a GUI (Graphical User Interface): Add maps, character portraits, or inventory screens.
- [ ] Add a sound system: Enhance the gaming experience by adding sound effects or background music.
- [ ] Create different endings: Increase replayability by creating different endings based on player choices throughout the game.
- [ ] Add achievements or trophies: Implement an achievement system to give players a sense of accomplishment.
- [ ] Add modding support: Allow players to modify the game and create their own content.


## GIF Demo

Demonstration:

![Demo](https://github.com/Clad3815/adventure-game-ai/blob/master/gif/demo.gif)

Demonsration with debug mode:

![Demo Debug](https://github.com/Clad3815/adventure-game-ai/blob/master/gif/demo_debug.gif)


## Requirements

- Node.js (v14.0.0 or higher)
- [ai-function-helper](https://github.com/Clad3815/ai-function-helper/) library


## Installation

1. Clone this repository:

```bash
git clone https://github.com/clad3815/adventure-game-ai.git
```

2. Install dependencies:

```bash
npm install
```

3. Make sure you have [ai-function-helper](https://github.com/Clad3815/ai-function-helper/) installed and configured with your OpenAI API key.

4. Edit the `game.js` file to change the [ai-function-helper](https://github.com/Clad3815/ai-function-helper/) path


## Usage

1. Run the script:

```bash
node game.js
```

2. Follow the prompts to customize your game and create your character. You can also use the default settings by pressing `Enter` when prompted.

3. Play the generated game and enjoy the adventure!

## Debug
To activate debug mode and AI debug mode within the `game.js` file, you can follow these simple steps:

1. Locate the `game.js` file in your project directory.

2. Open the `game.js` file in your preferred code editor.

3. Find the following lines of code:

```javascript
const enableDebug = false; // Set to true to enable debug mode
const enableAIDebug = false; // Set to true to enable debug mode for AI request/answer

```

4. To enable debug mode, change the value of enableDebug to true, this will show all prompt and answer from AI.

```javascript
const enableDebug = true; // Set to true to enable debug mode
```

5. To enable AI debug mode, change the value of enableAIDebug to true, this will show all data sent and answer from AI (Without the full prompt).

```javascript
const enableAIDebug = true; // Set to true to enable debug mode for AI request/answer
```



## Contributing

Contributions are welcome! If you would like to add more features, improve the existing code, or fix bugs, please feel free to submit a pull request.

## License

This project is licensed under the MIT License.