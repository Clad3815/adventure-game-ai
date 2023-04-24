const readline = require('readline');
const aiFunction = require('../ai-function-helper/src/aiFunction');
const chalk = require('chalk'); // Import chalk
const fs = require('fs');
// const ora = require('ora'); // Import ora for the spinner

let ora;

let firstBoot = true;

let translateTextTable = {
    error: 'Error',
    generating_class: 'Generating player classes...',
    choose_player_username: 'Choose your player username',
    choose_game_environment: 'Choose the environment of the game (cyberpunk, medieval, Star Wars, ...)',
    choose_game_environment_default: 'cyberpunk',
    choose_game_difficulty: 'Choose the difficulty of the game (easy, medium, hard, etc.)',
    choose_game_difficulty_default: 'easy',
    choose_player_scenario: 'Write a short scenario for the start of the game (Optional)',
    choose_player_sex: 'Choose the sex of your character',
    choose_player_sex_default: 'male',
    choose_player_description: 'Choose the description of your character and all his traits',
    choose_player_description_default: 'Nothing special',
    select_player_action: 'Choose your next action (1, 2, etc ...) or enter custom action',
    select_player_action_custom: 'Your next action',
    player_level_change: 'Your level is now:',
    player_hp_change: 'Your HP is now:',
    player_mana_change: 'Your mana is now:',
    player_exp_change: 'Your experience is now:',
    player_next_level_exp_change: 'Your next level experience is now:',
    player_money_change: 'Your money is now:',
    player_interface_value_change: 'change',
    player_location_change: 'Your location is now:',
    player_new_quest: 'You have a new quest:',
    player_new_item: 'You got new items:',
    player_lost_item: 'You lost items:',
    accept_ia_answer: 'Accept AI answer?',
    loading_message: 'Loading...',
    translating_text: 'Translating...',
    choose_player_class: 'Choose a class',
    welcome_game: 'Welcome, [username] ! The game is about to start. Have fun!',
    player_start_game: 'Starting the game...',
    shortening_sentence: 'Optimizing text size...',
    init_player_attribute: 'Initializing player attributes...',
    get_narrative_text: 'Generating narrative text...',
    update_inventory_stats: 'Updating player/inventory/location/quest data...',
    generate_game_scenario: 'Generating game scenario...',
    generate_possible_choices: 'Generating possible choices...',
    update_player_inventory: 'Update player inventory...',
    update_player_location: 'Update player location...',
    update_player_quest: 'Update player quest...',
    update_player_stats: 'Update player stats...',

}

async function loadOra() {
    ora = (await
        import ('ora')).default;
}

let spinner;

const enableDebug = false; // Set to true to enable debug mode
const enableAIDebug = false; // Set to true to enable debug mode for AI request/answer
let translateMenu = false; // Set to true to translate the menu

let choosenLanguage = '';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});


async function getUserInput(prompt, translate = false, defaultInput = '') {
    prompt = prompt.trim();
    if (translate) prompt = await TranslateText(prompt);
    if (defaultInput != '') prompt = prompt + ` [${defaultInput}] : `;
    else prompt = prompt + ' : ';
    return new Promise((resolve) => {
        rl.question(chalk.yellow(prompt), (input) => {
            if (defaultInput != '' && input == '') {
                input = defaultInput;
            }
            resolve(input);
        });
    });
}

let possible_classes = [];

async function TranslateMenuText(language) {
    spinner = await ora(translateTextTable.translating_text).start();
    spinner.start();
    let aiData = await aiFunction({
        args: {
            data: translateTextTable,
            to: language,
        },
        functionName: "translate_text",
        description: `Generate a translate dict from the "data" dict value from one language to another. Use the "to" arguments to specify destination language. The text is from a game user interface.`,
        funcReturn: "list[dict[index: str, value: str]]",
        showDebug: enableDebug,
        temperature: 0.3,
    });
    for (const [key, value] of Object.entries(aiData)) {
        translateTextTable[value.index] = value.value;
    }
    spinner.stop();
    return aiData;
}


async function TranslateText(text) {
    if (choosenLanguage == '' || choosenLanguage == 'en' || !translateMenu) {
        return text;
    }
    spinner = await ora(translateTextTable.translating_text).start();
    spinner.start();
    let aiData = await aiFunction({
        args: {
            text: text,
            to: choosenLanguage,
        },
        functionName: "translate_text",
        description: "Translate text from one language to another. Use the to arguments to specify destination language. The text is from a game user interface. Return a string with the translated text.",
        funcReturn: "str",
        showDebug: false,
        autoConvertReturn: true,
        temperature: 0.3,
    });
    spinner.stop();
    return aiData;
}

async function shortenSentence(sentence) {
    spinner = await ora(translateTextTable.shortening_sentence).start();
    spinner.start();
    let aiData = await aiFunction({
        args: {
            sentence: sentence,
        },
        functionName: "shorten_sentence",
        description: "Rewrite the sentence to a minimum of words without breaking the context or important data. If the sentence can't be shorten, it will return the same sentence.",
        funcReturn: "str",
        temperature: 1,
    });
    spinner.stop();
    return aiData;
}

async function initializePlayerAttributes(gameState, playerClass, playerSex, playerDescription) {
    let prompt = fs.readFileSync('./prompt/generate_player_attributes.txt', 'utf8');
    spinner = await ora(translateTextTable.init_player_attribute).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            gameSettings: gameState.gameSettings,
            playerDescription: playerDescription,
            playerSex: playerSex,
            playerClass: playerClass,
            playerLevel: 1,
        },
        functionName: "generate_player_attribut",
        description: prompt,
        funcReturn: "dict[hp, max_hp, mana, max_mana, money, attributes_list]",
        showDebug: enableDebug,
        autoConvertReturn: true,
        temperature: 0.7,
    });
    spinner.stop();
    if (aiData == null) {
        console.log(chalk.red(`####################`));
        console.log(chalk.red(`${translateTextTable.error}: ${aiData}`));
        console.log(chalk.red(`####################`));
        return [];
    }

    return aiData;
}

async function generateValidClass(gameState, playerDescription, playerSex) {
    let prompt = fs.readFileSync('./prompt/generate_random_classes.txt', 'utf8');
    spinner = await ora(translateTextTable.generating_class).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            gameSettings: gameState.gameSettings,
            playerDescription: playerDescription,
            playerSex: playerSex,
            playerLevel: 1,
        },
        functionName: "generate_player_class",
        description: prompt,
        funcReturn: "list[str]",
        showDebug: enableDebug,
        autoConvertReturn: true,
        temperature: 0.7,
    });
    spinner.stop();
    if (aiData == null) {
        console.log(chalk.red(`####################`));
        console.log(chalk.red(`${translateTextTable.error}: ${aiData}`));
        console.log(chalk.red(`####################`));
        return [];
    }
    return aiData;
}

async function getValidClass(validClasses) {
    let playerClass;
    do {
        playerClass = await getUserInput(translateTextTable.choose_player_class + ' (' + validClasses.join(', ') + ')', false, validClasses[0]);
    } while (!validClasses.includes(playerClass));

    return playerClass;
}

// Function to generate narrative text
async function generateNarrativeText(gameState) {
    // Add your code here to call the AI and generate the narrative text based on the current choice
    let prompt = fs.readFileSync('./prompt/get_narrative_text.txt', 'utf8');
    spinner = await ora(translateTextTable.get_narrative_text).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            current_choice: gameState.current_choice,
            text_history: gameState.text_history,
            playerData: gameState.playerData,
            gameSettings: gameState.gameSettings,
        },
        functionName: "generate_narrative_text",
        description: prompt,
        funcReturn: "dict[narrative_text:str, needPlayerUpdate:bool, needInventoryUpdate:bool, needLocationUpdate:bool, needQuestUpdate:bool, isGameOver:bool]",
        // showDebug: enableDebug,
        showDebug: enableDebug,
        temperature: 0.8,
        presence_penalty: 0.6,
    });
    spinner.stop();
    return aiData;
}

// Function to update inventory and stats
async function updateInventoryAndStats(gameState, narrativeText) {
    // Add your code here to call the AI and update the inventory and stats based on the generated narrative text
    let prompt = fs.readFileSync('./prompt/update_inventory_and_stats.txt', 'utf8');
    if (gameState.playerData.inventory == null || gameState.playerData.inventory.length == 0) {
        prompt += `\nVERY IMPORTANT: If the player has no inventory or an empty inventory, generate a set of inventory item for the start of the game (up to 10 items).
        Consider the gameSettings to adapt the items data such as language(ensure the output text matches the selected language), difficulty, game environment(e.g., cyberpunk, medieval, fantasy), and other settings.
        Example of item: 
        [{
        "name": "Knife",
        "count": 1,
        "type": "weapon",
        "value": 1,
        "equipped": true,
        }, ...]
        VERY IMPORTANT:  And generate a player "location" based on the narrativeText (home, forest, etc ...). 
        Example of location:
        {
            "location_name": "Home of the lawyer",
            "location_short_reason": "You are there for the quest given by your employer.", // A short reason why the player is there
            "location_type": "home",
            "location_sub": "Living Room",
        }
				`;
    }
    spinner = await ora(translateTextTable.update_inventory_stats).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            playerData: gameState.playerData,
            narrativeText: narrativeText,
            gameSettings: gameState.gameSettings,
        },
        functionName: "update_inventory_and_stats",
        description: prompt,
        funcReturn: "dict",
        showDebug: enableDebug,
        temperature: 0.8,
    });
    spinner.stop();
    return aiData;
}

async function generateGameScenario(gameState, player, playerScenario) {
    if (playerScenario != '') {
        spinner = await ora(translateTextTable.generate_game_scenario).start();
        spinner.start();
        baseScenario = await aiFunction({
            args: {
                gameSettings: gameState.gameSettings,
                playerData: {
                    username: player.username,
                    description: player.description,
                    attributes: player.attributes_list,
                    class: player.class,
                    sex: player.sex,
                    level: 1
                },
                main_idea: playerScenario,
            },
            functionName: "generate_player_scenario",
            description: `Generate a coherent text-based adventure game starting scenario for the player using the main idea, use the player level to determine the scenario. Use the gameSettings to modify game aspects like language (The output text must match the language selected), difficulty, game environment (cyberpunk, medieval, fantasy, etc.), and other settings. The scenario will be the start of the game, it's must be entertaining and coherent.`,
            funcReturn: "str",
            showDebug: enableDebug,
            temperature: 0.7,
        });
        spinner.stop();
    } else {
        spinner = await ora(translateTextTable.generate_game_scenario).start();
        spinner.start();
        baseScenario = await aiFunction({
            args: {
                gameSettings: gameState.gameSettings,
                playerData: {
                    username: player.username,
                    description: player.description,
                    attributes: player.attributes_list,
                    class: player.class,
                    sex: player.sex
                }
            },
            functionName: "generate_player_scenario",
            description: "Generate a coherent text-based adventure game starting scenario for the player (The player data can be used for the scenario), use the player level to determine the scenario. Use the gameSettings to modify game aspects like language (The output text must match the language selected), difficulty, game environment (cyberpunk, medieval, fantasy, etc.), and other settings. The scenario will be the start of the game, it's must be entertaining and coherent.",
            funcReturn: "str",
            showDebug: enableDebug,
            temperature: 0.7,
        });
        spinner.stop();
    }
    return baseScenario;
}

// Function to generate possible choices
async function generatePossibleChoices(gameState, narrativeText) {
    const prompt = fs.readFileSync('./prompt/generate_narrative_choices.txt', 'utf8');
    spinner = await ora(translateTextTable.generate_possible_choices).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            playerData: gameState.playerData,
            narrativeText: narrativeText,
            gameSettings: gameState.gameSettings,
        },
        functionName: "generate_narrative_choices",
        description: prompt,
        funcReturn: "list[str]",
        showDebug: enableDebug,
        temperature: 0.8,
    });
    spinner.stop();
    return aiData;
}

function syncInventoryAndStats(updatedInventoryStats, gameState) {
    if (updatedInventoryStats.playerData.inventory) {
        gameState.playerData.inventory = updatedInventoryStats.playerData.inventory;
    }
    if (updatedInventoryStats.playerData.hp) {
        gameState.playerData.hp = updatedInventoryStats.playerData.hp;
    }
    if (updatedInventoryStats.playerData.max_hp) {
        gameState.playerData.max_hp = updatedInventoryStats.playerData.max_hp;
    }
    if (updatedInventoryStats.playerData.money) {
        gameState.playerData.money = updatedInventoryStats.playerData.money;
    }
    if (updatedInventoryStats.playerData.mana) {
        gameState.playerData.mana = updatedInventoryStats.playerData.mana;
    }
    if (updatedInventoryStats.playerData.max_mana) {
        gameState.playerData.max_mana = updatedInventoryStats.playerData.max_mana;
    }
    if (updatedInventoryStats.playerData.exp) {
        gameState.playerData.exp = updatedInventoryStats.playerData.exp;
    }
    if (updatedInventoryStats.playerData.next_level_exp) {
        gameState.playerData.next_level_exp = updatedInventoryStats.playerData.next_level_exp;
    }

    if (updatedInventoryStats.playerData.level) {
        gameState.playerData.level = updatedInventoryStats.playerData.level;
    }

    if (updatedInventoryStats.playerData.location) {
        gameState.playerData.location = updatedInventoryStats.playerData.location;
    }

    if (updatedInventoryStats.playerData.quest) {
        gameState.playerData.quest = updatedInventoryStats.playerData.quest;
    }

    return gameState;
}
async function showNewItemsAndStats(updatedInventoryStats, gameState) {
    const logIfChanged = (oldValue, newValue, message, calculationMessage = null) => {
        if (newValue && newValue != oldValue) {
            const outputMessage = calculationMessage ?
                `${message} (${calculationMessage})` :
                message;
            console.log(chalk.green(outputMessage));
        }
    };

    const newPlayer = updatedInventoryStats.playerData;
    const oldPlayer = gameState.playerData;

    // if (enableAIDebug) console.log('newPlayer', JSON.stringify(newPlayer));
    // if (enableAIDebug) console.log('oldPlayer', JSON.stringify(oldPlayer));
    if (newPlayer) {
        logIfChanged(oldPlayer.level, newPlayer.level, `>>> ${translateTextTable.player_level_change} ${newPlayer.level}`);
        logIfChanged(oldPlayer.hp, newPlayer.hp, `>>> ${translateTextTable.player_hp_change} ${newPlayer.hp}/${oldPlayer.max_hp}`, translateTextTable.player_interface_value_change + `: ${newPlayer.hp - oldPlayer.hp}`);
        logIfChanged(oldPlayer.mana, newPlayer.mana, `>>> ${translateTextTable.player_mana_change} ${newPlayer.mana}/${oldPlayer.max_mana}`, translateTextTable.player_interface_value_change + `: ${newPlayer.mana - oldPlayer.mana}`);
        logIfChanged(oldPlayer.exp, newPlayer.exp, `>>> ${translateTextTable.player_exp_change} ${newPlayer.exp}`, translateTextTable.player_interface_value_change + `: ${newPlayer.exp - oldPlayer.exp}`);
        logIfChanged(oldPlayer.next_level_exp, newPlayer.next_level_exp, `>>> ${translateTextTable.player_next_level_exp_change} ${newPlayer.next_level_exp}`);
        logIfChanged(oldPlayer.money, newPlayer.money, `>>> ${translateTextTable.player_money_change} ${newPlayer.money}`, translateTextTable.player_interface_value_change + `: ${newPlayer.money - oldPlayer.money}`);
    }

    const newLocation = newPlayer.location;
    const oldLocation = oldPlayer.location;

    if (newLocation) {
        logIfChanged(oldLocation.location_name, newLocation.location_name, `>>> ${translateTextTable.player_location_change} ${newLocation.location_name}`);
        logIfChanged(oldLocation.location_short_reason, newLocation.location_short_reason, `>>> Location Reason: ${newLocation.location_short_reason}`);
        logIfChanged(oldLocation.location_type, newLocation.location_type, `>>> Location Type: ${newLocation.location_type}`);
        logIfChanged(oldLocation.location_sub, newLocation.location_sub, `>>> Location Sublocation: ${newLocation.location_sub}`);
    }

    const newQuest = newPlayer.quest;
    const oldQuest = oldPlayer.quest;

    if (newQuest) {
        logIfChanged(oldQuest.quest_name, newQuest.quest_name, `>>> ${translateTextTable.player_new_quest} ${newQuest.quest_name}`);
        logIfChanged(oldQuest.quest_description, newQuest.quest_description, `>>> Quest Description: ${newQuest.quest_description}`);
        logIfChanged(oldQuest.quest_status, newQuest.quest_status, `>>> Quest Status: ${newQuest.quest_status}`);
        logIfChanged(oldQuest.quest_current_step, newQuest.quest_current_step, `>>> Quest Current Step: ${newQuest.quest_current_step}`);
        logIfChanged(oldQuest.quest_total_step, newQuest.quest_total_step, `>>> Quest Step Total: ${newQuest.quest_total_step}`);
        logIfChanged(oldQuest.quest_reward, newQuest.quest_reward, `>>> Quest Reward: ${newQuest.quest_reward}`);
    }
    if (updatedInventoryStats.playerData && updatedInventoryStats.playerData.inventory) {
        let newItems = [];
        let removedItems = [];
        let inventory = updatedInventoryStats.playerData.inventory;
        let oldInventory = gameState.playerData.inventory;
        for (let i = 0; i < inventory.length; i++) {
            let found = false;
            for (let j = 0; j < oldInventory.length; j++) {
                if (inventory[i].name == oldInventory[j].name) {
                    found = true;
                    if (inventory[i].count != oldInventory[j].count) {
                        if (inventory[i].count > oldInventory[j].count) {
                            newItems.push({
                                name: inventory[i].name,
                                count: inventory[i].count - oldInventory[j].count,
                            });
                        } else {
                            removedItems.push({
                                name: inventory[i].name,
                                count: oldInventory[j].count - inventory[i].count,
                            });
                        }
                    }
                }
            }
            if (!found) {
                newItems.push({
                    name: inventory[i].name,
                    count: inventory[i].count,
                });
            }
        }
        for (let i = 0; i < oldInventory.length; i++) {
            let found = false;
            for (let j = 0; j < inventory.length; j++) {
                if (oldInventory[i].name == inventory[j].name) {
                    found = true;
                }
            }
            if (!found) {
                removedItems.push({
                    name: oldInventory[i].name,
                    count: oldInventory[i].count,
                });
            }
        }
        if (newItems.length > 0) {
            console.log(chalk.yellow(`>>> ${translateTextTable.player_new_item} `) + `${newItems.map(item => `${item.count} ${item.name}`).join(', ')}`);
           }
           if (removedItems.length > 0) {
               console.log(chalk.red(`>>> ${translateTextTable.player_lost_item}`) + `${removedItems.map(item => `${item.count} ${item.name}`).join(', ')}`);
           }
       }
}

async function updatePlayerInventory(gameState, narrativeText) {
    let prompt = fs.readFileSync('./prompt/update_player_inventory.txt', 'utf8');
    spinner = await ora(translateTextTable.update_player_inventory).start();
    spinner.start();
    let args = {
        inventory: gameState.playerData.inventory,
        narrativeText: narrativeText,
        gameSettings: gameState.gameSettings,
    };
    if (gameState.playerData.inventory == null || gameState.playerData.inventory.length == 0) {
        prompt += `\nVERY IMPORTANT: If the player has no inventory or an empty inventory, generate a set of inventory item for the start of the game (up to 10 items). Use every player and game information to generate it
        Example of item: 
        [{
        "name": "Knife",
        "count": 1,
        "type": "weapon",
        "value": 1,
        "equipped": true,
        }, ...]

        Don't return an empty list or null.
				`;
        args.playerData = gameState.playerData;
    } else {
        prompt += `\nVERY IMPORTANT: Return an empty inventory if nothing changed from the input inventory.`;
    }
    aiData = await aiFunction({
        args: args,
        functionName: "update_player_inventory",
        description: prompt,
        funcReturn: "list[dict[name:str, count:int, type:str, value:int, equipped:bool]]",
        showDebug: enableDebug,
        temperature: 0.7,
    });
    spinner.stop();
    return aiData;
}

async function updatePlayerStats(gameState, narrativeText) {
    let prompt = fs.readFileSync('./prompt/update_player_data.txt', 'utf8');
    spinner = await ora(translateTextTable.update_player_stats).start();
    spinner.start();
    
    aiData = await aiFunction({
        args: {
            playerData: {
                hp: gameState.playerData.hp,
                max_hp: gameState.playerData.max_hp,
                mana: gameState.playerData.mana,
                max_mana: gameState.playerData.max_mana,
                money: gameState.playerData.money,
                exp: gameState.playerData.exp,
                level: gameState.playerData.level,
                next_level_exp: gameState.playerData.next_level_exp,
            },
            narrativeText: narrativeText,
            gameSettings: gameState.gameSettings,
        },
        functionName: "update_player_stats",
        description: prompt,
        funcReturn: "dict[hp: int, max_hp: int, mana: int, max_mana: int, money: int, exp: int, level: int, next_level_exp: int]",
        showDebug: enableDebug,
        temperature: 0.4,
    });
    spinner.stop();
    return aiData;
}

async function updatePlayerQuest(gameState, narrativeText) {
    let prompt = fs.readFileSync('./prompt/update_player_quest.txt', 'utf8');
    spinner = await ora(translateTextTable.update_player_quest).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            questData: gameState.playerData.quest,
            narrativeText: narrativeText,
            gameSettings: gameState.gameSettings,
        },
        functionName: "update_player_quest",
        description: prompt,
        funcReturn: "dict[quest_name: str, quest_description: str, quest_status: str, quest_current_step: int, quest_total_step: int, quest_reward: str]",
        showDebug: enableDebug,
        temperature: 0.7,
    });
    spinner.stop();
    return aiData;
}

async function updatePlayerLocation(gameState, narrativeText) {
    let prompt = fs.readFileSync('./prompt/update_player_location.txt', 'utf8');
    spinner = await ora(translateTextTable.update_player_location).start();
    spinner.start();
    aiData = await aiFunction({
        args: {
            location: gameState.playerData.location,
            narrativeText: narrativeText,
            gameSettings: gameState.gameSettings,
        },
        functionName: "update_player_location",
        description: prompt,
        funcReturn: "dict[location_name: str, location_short_reason: str, location_type: str, location_sub: str]",
        showDebug: enableDebug,
        temperature: 0.7,
    });
    spinner.stop();
    return aiData;
}

async function updatePlayerDataIfNeeded(gameState, narrativeText, narrativeTextRequest = false) {
    // Copy gameState to a new variable
    let newGameState = JSON.parse(JSON.stringify(gameState));

    if (narrativeTextRequest && narrativeTextRequest.needPlayerUpdate) {
        const debugPlayerData = {
            hp: gameState.playerData.hp,
            max_hp: gameState.playerData.max_hp,
            mana: gameState.playerData.mana,
            max_mana: gameState.playerData.max_mana,
            money: gameState.playerData.money,
            exp: gameState.playerData.exp,
            level: gameState.playerData.level,
            next_level_exp: gameState.playerData.next_level_exp,
        };
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Send stats data for update: `) + chalk.green(`${JSON.stringify(debugPlayerData)}`));
        let testPlayerUpdate = await updatePlayerStats(newGameState, narrativeText);
        newGameState.playerData.hp = testPlayerUpdate.hp;
        newGameState.playerData.max_hp = testPlayerUpdate.max_hp;
        newGameState.playerData.mana = testPlayerUpdate.mana;
        newGameState.playerData.max_mana = testPlayerUpdate.max_mana;
        newGameState.playerData.money = testPlayerUpdate.money;
        newGameState.playerData.exp = testPlayerUpdate.exp;
        newGameState.playerData.level = testPlayerUpdate.level;
        newGameState.playerData.next_level_exp = testPlayerUpdate.next_level_exp;
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Got stats data from update: `) + chalk.green(`${JSON.stringify(testPlayerUpdate)}`));
    }

    if (narrativeTextRequest === false || narrativeTextRequest.needLocationUpdate) {
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Send location data for update: `) + chalk.green(`${JSON.stringify(gameState.playerData.location)}`));
        let testLocationUpdate = await updatePlayerLocation(newGameState, narrativeText);
        newGameState.playerData.location = testLocationUpdate;
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Got location data from update: `) + chalk.green(`${JSON.stringify(testLocationUpdate)}`));
    }
    
    if (narrativeTextRequest === false || narrativeTextRequest.needQuestUpdate) {
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Send quest data for update: `) + chalk.green(`${JSON.stringify(gameState.playerData.quest)}`));
        let testQuestUpdate = await updatePlayerQuest(newGameState, narrativeText);
        newGameState.playerData.quest = testQuestUpdate;
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Got quest data from update: `) + chalk.green(`${JSON.stringify(testQuestUpdate)}`));
    }

    if (narrativeTextRequest === false || narrativeTextRequest.needInventoryUpdate) {
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Send inventory data for update: `) + chalk.green(`${JSON.stringify(gameState.playerData.inventory)}`));
        let testInventoryUpdate = await updatePlayerInventory(newGameState, narrativeText);
        if (testInventoryUpdate.length > 0) newGameState.playerData.inventory = testInventoryUpdate;
        if (enableAIDebug) console.log(chalk.red(`[DEBUG] Got inventory data from update: `) + chalk.green(`${JSON.stringify(testInventoryUpdate)}`));
    }


    return newGameState;
    // narrativeTextRequest.needPlayerUpdate || narrativeTextRequest.needInventoryUpdate || narrativeTextRequest.needLocationUpdate || narrativeTextRequest.needQuestUpdate
}

async function main() {
    await loadOra();
    spinner = await ora(translateTextTable.loading_message).start();
    spinner.stop(); 
    console.log(chalk.red(`############################`));
    console.log(chalk.red(`## Generate Your Own Game ##`));
    console.log(chalk.red(`############################`));
    let prompt = fs.readFileSync('./prompt/game_prompt.txt', 'utf8');
    const gameLanguage = await getUserInput('Choose the language of the game (en, fr, etc.)', false, 'en');
    if (gameLanguage != 'en') 
    {
        const translateMenuAsk = await getUserInput('Do you want to translate the menu of the game? (y/n)', false, 'n');
        translateMenu = (translateMenuAsk == 'yes' || translateMenuAsk == 'y') ? true : false;
        if (translateMenu) await TranslateMenuText(gameLanguage);
    }
    choosenLanguage = gameLanguage;
    const username = await getUserInput(translateTextTable.choose_player_username, false, 'Jack');
    const gameEnvironment = await getUserInput(translateTextTable.choose_game_environment, false, translateTextTable.choose_game_environment_default);
    const playerScenario = await getUserInput(translateTextTable.choose_player_scenario, false, '');
    const gameDifficulty = await getUserInput(translateTextTable.choose_game_difficulty, false, translateTextTable.choose_game_difficulty_default);
    const playerSex = await getUserInput(translateTextTable.choose_player_sex, false, translateTextTable.choose_player_sex_default);
    const description = await getUserInput(translateTextTable.choose_player_description, false, translateTextTable.choose_player_description_default);

    let player;
    let Welcome = `\n${translateTextTable.welcome_game} `.replace('[username]', username);
    console.log(chalk.green(Welcome));

    let gameState = {
        gameSettings: {
            gameEnvironment: gameEnvironment,
            gameDifficulty: gameDifficulty,
            gameLanguage: gameLanguage
        },
    };

    possible_classes = await generateValidClass(gameState, description, playerSex);
    const playerClass = await getValidClass(possible_classes);
    player = {
        username,
        class: playerClass,
        sex: playerSex,
        playerDescription: description,
        ...await initializePlayerAttributes(gameState, playerClass, playerSex, description),
    };
    let baseScenario;

    baseScenario = await generateGameScenario(gameState, player, playerScenario);

    console.log(chalk.green(`\nScenario: `) + chalk.yellow(`${baseScenario}`) + `\n`);
    gameState = {
        text_history: [],
        current_choice: null,
        playerData: {
            hp: player.hp,
            max_hp: player.max_hp,
            money: player.money,
            mana: player.mana,
            max_mana: player.max_mana,
            exp: 0,
            next_level_exp: 100,
            level: 1,
            class: player.class,
            sex: player.sex,
            username: player.username,
            description: player.playerDescription,
            attributes: player.attributes_list,
            inventory: [],
            location: {
                "location_name": "",
                "location_short_reason": "",
                "location_type": "",
                "location_sub": "",
            },
            quest: {
                "quest_name": "No Quest",
                "quest_description": "Find a quest to start your adventure !",
                "quest_status": "Not Started",
                "quest_total_step": 1,
                "quest_current_step": 1,
                "quest_reward": ""
            }
        },
        gameSettings: {
            gameEnvironment: gameEnvironment,
            gameDifficulty: gameDifficulty,
            gameLanguage: gameLanguage
        },
    };
    
    let startInventoryUpdate = await updatePlayerDataIfNeeded(gameState, baseScenario);

    while (startInventoryUpdate.playerData.inventory.length == 0) {
        startInventoryUpdate = await updatePlayerDataIfNeeded(gameState, baseScenario);
    }
    await showNewItemsAndStats(startInventoryUpdate, gameState);
    
    gameState = syncInventoryAndStats(startInventoryUpdate, gameState);

    while (true) {
        let currentChoice;
        let updatedInventoryStats;
        let narrativeText;
        let updateInventory = false;
        let gameOver;
        try {
            currentChoice = gameState.current_choice;
            if (firstBoot) {
                narrativeText = baseScenario;
                console.log("\nNarrative: " + chalk.cyan(narrativeText));
            } else {
                if (enableAIDebug) {
                    console.log(chalk.red(`[DEBUG] Data for narrative text: `) + chalk.green(`${JSON.stringify(gameState)}`));
                }
                const narrativeTextRequest = await generateNarrativeText(gameState);
                narrativeText = narrativeTextRequest.narrative_text;
                gameOver = narrativeTextRequest.game_over;
                if (enableAIDebug) {
                    console.log(chalk.red(`[DEBUG] Narrative text: `) + chalk.green(`${JSON.stringify(narrativeTextRequest)}`));
                }
                console.log("\nNarrative: " + chalk.cyan(narrativeText));
                updateInventory = narrativeTextRequest.needPlayerUpdate || narrativeTextRequest.needInventoryUpdate || narrativeTextRequest.needLocationUpdate || narrativeTextRequest.needQuestUpdate || (gameState.playerData.inventory == null || gameState.playerData.inventory.length == 0);
                if (updateInventory) {
                    updatedInventoryStats = await updatePlayerDataIfNeeded(gameState, narrativeText, narrativeTextRequest);
                } else {
                    if (enableAIDebug) console.log(chalk.red(`[DEBUG] No need to update inventory and stats`));
                }
                spinner.stop();
            }


        } catch (error) {
            spinner.stop(); 
            console.log(error);
            continue;
        }
        if (updateInventory) {
            if (!updatedInventoryStats.playerData || !updatedInventoryStats.playerData.inventory || !updatedInventoryStats.playerData.inventory[0] || !updatedInventoryStats.playerData.inventory[0].name) {
                if (enableAIDebug) console.log(chalk.red(`[DEBUG] Incorrect player data, re-generating ...`));
                continue;
            }
            await showNewItemsAndStats(updatedInventoryStats, gameState);
        }
        if (!firstBoot) {
            const acceptIAAnswer = await getUserInput(chalk.magenta(translateTextTable.accept_ia_answer + ' (y/n) '));
            if (acceptIAAnswer.toLowerCase() != 'y') {
                console.log(' ');
                continue;
            }
        }

        if (updateInventory) gameState = syncInventoryAndStats(updatedInventoryStats, gameState);
        
        const possibleChoices = await generatePossibleChoices(gameState, narrativeText);
        let userInput;
        if (possibleChoices.length > 0) {
            possibleChoices.forEach((choice, index) => {
                console.log(chalk.yellow(`${index + 1}: ${choice}`));
            });
            userInput = await getUserInput(chalk.magenta(translateTextTable.select_player_action));
            userInput = userInput >= 1 && userInput <= possibleChoices.length ? possibleChoices[userInput - 1] : userInput;
        } else {
            userInput = await getUserInput(chalk.magenta(translateTextTable.select_player_action_custom));
        }

        console.log(' ');
    
        if (currentChoice) {
            gameState.text_history.push({
                narrative_text: await shortenSentence(currentChoice.narrative_text),
                user_choice: currentChoice.user_choice,
            });
        }
		

		gameState.current_choice = {
			narrative_text: narrativeText,
			user_choice: userInput,
		};

        if (gameState.text_history.length > 4) {
            gameState.text_history.shift();
        }
        if (firstBoot) firstBoot = false;

        if (gameOver) {
            break;
        }
    }

    rl.close();


}
main();