const readline = require('readline');
const createAiFunctionInstance = require('../ai-function-helper/src/aiFunction');
require('dotenv').config();
const aiFunction = createAiFunctionInstance(process.env.OPENAI_API_KEY);

const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

let translateTextTable = require('./lang');


let ora;

let firstBoot = true;

let gameState;

async function loadOra() {
    ora = (await
        import ('ora')).default;
}

let spinner;

const enableDebug = false; // Set to true to enable debug mode
const enableAIDebug = true; // Set to true to enable debug mode for AI request/answer
let translateMenu = false; // Set to true to translate the menu

let choosenLanguage = '';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});


async function getUserInput(prompt, defaultInput = '') {
    prompt = prompt.trim();
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
    // Define the file path for the translated menu
    const filePath = path.join(__dirname, `translate/translatedMenu_${language}.json`);

    // Check if the file exists
    if (fs.existsSync(filePath)) {
        // Load the translation from the file
        translateTextTable = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
        // Translate the text in chunks of 10 items and save it to a file
        spinner = await ora(translateTextTable.translating_text).start();
        spinner.start();

        let translateTextTableKeys = Object.keys(translateTextTable);
        let aiData = [];

        for (let i = 0; i < translateTextTableKeys.length; i += 10) {
            let chunk = {};

            // Create a chunk of 10 items
            for (let j = 0; j < 10 && i + j < translateTextTableKeys.length; j++) {
                const key = translateTextTableKeys[i + j];
                chunk[key] = translateTextTable[key];
            }

            // Translate the chunk
            let chunkTranslation = await aiFunction({
                args: {
                    data: chunk,
                    to: language,
                },
                functionName: "translate_text",
                description: `Generate a translate dict from the "data" dict value from one language to another. Use the "to" arguments to specify destination language. The text is from a game user interface.`,
                funcReturn: "list[dict[index: str, value: str]]",
                showDebug: enableDebug,
                temperature: 0.3,
            });

            aiData.push(...chunkTranslation);
        }

        // Update the translateTextTable
        for (const [key, value] of Object.entries(aiData)) {
            translateTextTable[value.index] = value.value;
        }

        // Save the translation to a file
        fs.writeFileSync(filePath, JSON.stringify(translateTextTable), 'utf8');

        spinner.stop();
    }

    return translateTextTable;
}


async function createSummaryTextHistory(gameState) {
    if (gameState.gameTextHistory.length == 0) return;
    if (enableAIDebug) console.log('[DEBUG] createSummaryTextHistory: ' + JSON.stringify(gameState.gameTextHistory));
    spinner = await ora(translateTextTable.create_summary_text_history).start();
    spinner.start();
    let aiData = await aiFunction({
        args: {
            text_history: gameState.gameTextHistory,
        },
        functionName: "create_summary_text_history",
        description: `Create a summary from a text history. The "text_history" argument contain a list of narrative_text with the player answer to the text. The goal is to summarize the history to a little text which explain all important point. The final text must contain maximum 100 words And must keep all important informations, the sentence need to be shortest possible the text is not designed to be display it's just a reminder for the AI. Example: 
"Jack went to the market to buy a sword, after that he go back to home and sleep very well" to 
"Jack go market buy sword, go home, sleep, etc ..."`,
        funcReturn: "str",
        // showDebug: true,
        showDebug: enableDebug,
        temperature: 1,
    });
    spinner.stop();
    if (enableAIDebug) console.log('[DEBUG] createSummaryTextHistory DONE: ' + JSON.stringify(aiData));
    gameState.story_summary = aiData;
}

async function initializePlayerAttributes(gameState, playerClass, playerSex, playerDescription) {
    let prompt = fs.readFileSync('./prompt/generate_player_attributes.txt', 'utf8');
    let args = {
        gameSettings: gameState.gameSettings,
        playerDescription: playerDescription,
        playerSex: playerSex,
        playerClass: playerClass,
        playerLevel: 1,
    };
    if (enableAIDebug) {
        console.log(chalk.red(translateTextTable.debug_init_attribute_send + ` `) + chalk.green(`${JSON.stringify(args)}`));
    }
    spinner = await ora(translateTextTable.init_player_attribute).start();
    spinner.start();
    aiData = await aiFunction({
        args: args,
        functionName: "generate_player_attribut",
        description: prompt,
        funcReturn: "dict[hp: int, max_hp: int, mana: int, max_mana: int, money: int, strength: int, intelligence: int, dexterity: int, constitution: int, special_attributes_list: list[str]]",
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
    if (enableAIDebug) {
        console.log(chalk.red(translateTextTable.debug_init_attribute_received + ` `) + chalk.green(`${JSON.stringify(aiData)}`));
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
async function getValidClass(gameState, description, playerSex) {
    let playerClass;
    let playerClassIndex;
    let validClasses = await generateValidClass(gameState, description, playerSex);
    let userInput;
    while (true) {
        console.log(translateTextTable.choose_player_class);
        validClasses.forEach((className, index) => {
            console.log(`${index + 1}: ${className}`);
        });
        console.log(`${validClasses.length + 1}: ${translateTextTable.regenerate_class}`);
        userInput = await getUserInput(translateTextTable.choose_number);

        playerClassIndex = parseInt(userInput, 10) - 1;
        if (userInput.trim() === '' || isNaN(playerClassIndex)) {
            console.log(translateTextTable.invalid_input);
            continue;
        }

        if (playerClassIndex === validClasses.length) {
            validClasses = await generateValidClass(gameState, description, playerSex);
        } else if (playerClassIndex >= 0 && playerClassIndex < validClasses.length) {
            playerClass = validClasses[playerClassIndex];
            break;
        } else {
            console.log(translateTextTable.invalid_input);
        }
    }

    return playerClass;
}

async function generateNarrativeText(gameState) {
    let prompt = fs.readFileSync('./prompt/multi_prompt/get_narrative_text.txt', 'utf8');
    let args = {
        // text_history: gameState.text_history,
        story_summary: (gameState.story_summary == gameState.current_choice.narrative_text) ? "" : gameState.story_summary,
        gameSettings: gameState.gameSettings,
        playerData: gameState.playerData,
        previous_choice: {
            previous_narrative_text: gameState.current_choice.narrative_text,
            previous_user_choice: gameState.current_choice.user_choice,
        },
    };
    if (enableAIDebug) {
        console.log(chalk.red(translateTextTable.debug_narrive_text_send + ` `) + chalk.green(`${JSON.stringify(args)}`));
    }
    spinner = await ora(translateTextTable.get_narrative_text).start();
    spinner.start();
    aiData = await aiFunction({
        args: args,
        functionName: "generate_narrative_text",
        description: prompt,
        funcReturn: "dict[next_narrative_text:str, needPlayerUpdate:bool, needInventoryUpdate:bool, needLocationUpdate:bool, needQuestUpdate:bool, isGameOver:bool]",
        // showDebug: true,
        showDebug: enableDebug,
        temperature: 0.6,
        presence_penalty: 0.6,
        frequency_penalty: 0.6,
        // model: "gpt4",
    });
    spinner.stop();
    if (enableAIDebug) {
        console.log(chalk.red(translateTextTable.debug_narrive_text_received + ` `) + chalk.green(`${JSON.stringify(aiData)}`));
    }
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
                    special_attributes: player.special_attributes_list,
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
            temperature: 1,
            presence_penalty: 0.6,
            frequency_penalty: 0.6,
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
                    special_attributes: player.special_attributes_list,
                    class: player.class,
                    sex: player.sex
                }
            },
            functionName: "generate_player_scenario",
            description: "Generate a coherent text-based adventure game starting scenario for the player (The player data can be used for the scenario), use the player level to determine the scenario. Use the gameSettings to modify game aspects like language (The output text must match the language selected), difficulty, game environment (cyberpunk, medieval, fantasy, etc.), and other settings. The scenario will be the start of the game, it's must be entertaining and coherent.",
            funcReturn: "str",
            showDebug: enableDebug,
            temperature: 0.7,
            presence_penalty: 0.6,
            frequency_penalty: 0.6,
        });
        spinner.stop();
    }
    return baseScenario;
}

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
        temperature: 1,
        presence_penalty: 0.6,
        frequency_penalty: 0.6,
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

const printCategory = (categoryName, items) => {
    console.log(chalk.bold(`\n######### ${categoryName} #########`));
    items.forEach(item => console.log(chalk.green(`>>> ${item}`)));
    console.log(chalk.bold(`############################${'#'.repeat(categoryName.length)}`));
};

async function showNewItemsAndStats(updatedInventoryStats, gameState) {
    const logIfChanged = (oldValue, newValue, message, calculationMessage = null) => {
        if (newValue && newValue != oldValue) {
            const outputMessage = calculationMessage ?
                `${message} (${calculationMessage})` :
                message;
            return chalk.green(outputMessage);
        }
        return null;
    };

    const newPlayer = updatedInventoryStats.playerData;
    const oldPlayer = gameState.playerData;
    const playerItems = [];

    if (newPlayer) {
        [
            logIfChanged(oldPlayer.level, newPlayer.level, `${translateTextTable.player_level_change} ${newPlayer.level}`),
            logIfChanged(oldPlayer.hp, newPlayer.hp, `${translateTextTable.player_hp_change} ${newPlayer.hp}/${oldPlayer.max_hp}`, `${translateTextTable.player_interface_value_change}: ${newPlayer.hp - oldPlayer.hp}`),
            logIfChanged(oldPlayer.mana, newPlayer.mana, `${translateTextTable.player_mana_change} ${newPlayer.mana}/${oldPlayer.max_mana}`, `${translateTextTable.player_interface_value_change}: ${newPlayer.mana - oldPlayer.mana}`),
            logIfChanged(oldPlayer.exp, newPlayer.exp, `${translateTextTable.player_exp_change} ${newPlayer.exp}`, `${translateTextTable.player_interface_value_change}: ${newPlayer.exp - oldPlayer.exp}`),
            logIfChanged(oldPlayer.next_level_exp, newPlayer.next_level_exp, `${translateTextTable.player_next_level_exp_change} ${newPlayer.next_level_exp}`),
            logIfChanged(oldPlayer.money, newPlayer.money, `${translateTextTable.player_money_change} ${newPlayer.money}`, `${translateTextTable.player_interface_value_change}: ${newPlayer.money - oldPlayer.money}`)
        ].forEach(item => {
            if (item !== null) {
                playerItems.push(item);
            }
        });
    }

    if (playerItems.length > 0) {
        printCategory('Player', playerItems);
    }

    const newLocation = newPlayer.location;
    const oldLocation = oldPlayer.location;
    const locationItems = [];

    if (newLocation) {
        [
            logIfChanged(oldLocation.location_name, newLocation.location_name, `${translateTextTable.player_location_change} ${newLocation.location_name}`),
            logIfChanged(oldLocation.location_short_reason, newLocation.location_short_reason, `${translateTextTable.player_location_reason} ${newLocation.location_short_reason}`),
            logIfChanged(oldLocation.location_type, newLocation.location_type, `${translateTextTable.player_location_type} ${newLocation.location_type}`),
            logIfChanged(oldLocation.location_sub, newLocation.location_sub, `${translateTextTable.player_location_sublocation} ${newLocation.location_sub}`)
        ].forEach(item => {
            if (item !== null) {
                locationItems.push(item);
            }
        });
    }

    if (locationItems.length > 0) {
        printCategory('Location', locationItems);
    }

    const newQuest = newPlayer.quest;
    const oldQuest = oldPlayer.quest;
    const questItems = [];

    if (newQuest) {
        [
            logIfChanged(oldQuest.quest_name, newQuest.quest_name, `${translateTextTable.player_new_quest} ${newQuest.quest_name}`),
            logIfChanged(oldQuest.quest_description, newQuest.quest_description, `${translateTextTable.player_quest_description} ${newQuest.quest_description}`),
            logIfChanged(oldQuest.quest_status, newQuest.quest_status, `${translateTextTable.player_quest_status} ${newQuest.quest_status}`),
            logIfChanged(oldQuest.quest_current_step, newQuest.quest_current_step, `${translateTextTable.player_quest_current_step} ${newQuest.quest_current_step}`),
            logIfChanged(oldQuest.quest_total_step, newQuest.quest_total_step, `${translateTextTable.player_quest_total_step} ${newQuest.quest_total_step}`),
            logIfChanged(oldQuest.quest_reward, newQuest.quest_reward, `${translateTextTable.player_quest_reward} ${newQuest.quest_reward}`)
        ].forEach(item => {
            if (item !== null) {
                questItems.push(item);
            }
        });
    }

    if (questItems.length > 0) {
        printCategory('Quest', questItems);
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

        if (newItems.length > 0 || removedItems.length > 0) {
            const inventoryItems = [];
            if (newItems.length > 0) {
                inventoryItems.push(chalk.yellow(`${translateTextTable.player_new_item} `) + `${newItems.map(item => `${item.count} ${item.name}`).join(', ')}`);
            }
            if (removedItems.length > 0) {
                inventoryItems.push(chalk.red(`${translateTextTable.player_lost_item} `) + `${removedItems.map(item => `${item.count} ${item.name}`).join(', ')}`);
            }
            printCategory('Inventory', inventoryItems);
        }
    }
}


async function updatePlayerInventory(gameState, narrativeText) {
    let prompt = fs.readFileSync('./prompt/multi_prompt/update_player_inventory.txt', 'utf8');
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
    let prompt = fs.readFileSync('./prompt/multi_prompt/update_player_data.txt', 'utf8');
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
    let prompt = fs.readFileSync('./prompt/multi_prompt/update_player_quest.txt', 'utf8');
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
    let prompt = fs.readFileSync('./prompt/multi_prompt/update_player_location.txt', 'utf8');
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
        if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_stats_data_update + ` `) + chalk.green(`${JSON.stringify(debugPlayerData)}`));
        let testPlayerUpdate = await updatePlayerStats(newGameState, narrativeText);
        newGameState.playerData.hp = testPlayerUpdate.hp;
        newGameState.playerData.max_hp = testPlayerUpdate.max_hp;
        newGameState.playerData.mana = testPlayerUpdate.mana;
        newGameState.playerData.max_mana = testPlayerUpdate.max_mana;
        newGameState.playerData.money = testPlayerUpdate.money;
        newGameState.playerData.exp = testPlayerUpdate.exp;
        newGameState.playerData.level = testPlayerUpdate.level;
        newGameState.playerData.next_level_exp = testPlayerUpdate.next_level_exp;
        if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_stats_data_updated  + ` `) + chalk.green(`${JSON.stringify(testPlayerUpdate)}`));
    }

    if (narrativeTextRequest === false || narrativeTextRequest.needLocationUpdate) {
        if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_location_data_update  + ` `) + chalk.green(`${JSON.stringify(gameState.playerData.location)}`));
        let testLocationUpdate = await updatePlayerLocation(newGameState, narrativeText);
        newGameState.playerData.location = testLocationUpdate;
        if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_location_data_updated  + ` `) + chalk.green(`${JSON.stringify(testLocationUpdate)}`));
    }
    
    if (narrativeTextRequest === false || narrativeTextRequest.needQuestUpdate) {
        if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_quest_data_update  + ` `) + chalk.green(`${JSON.stringify(gameState.playerData.quest)}`));
        let testQuestUpdate = await updatePlayerQuest(newGameState, narrativeText);
        newGameState.playerData.quest = testQuestUpdate;
        if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_quest_data_updated  + ` `) + chalk.green(`${JSON.stringify(testQuestUpdate)}`));
    }

    if (narrativeTextRequest === false || narrativeTextRequest.needInventoryUpdate) {
        if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_inventory_data_update + ` `) + chalk.green(`${JSON.stringify(gameState.playerData.inventory)}`));
        let testInventoryUpdate = await updatePlayerInventory(newGameState, narrativeText);
        if (testInventoryUpdate.length > 0) newGameState.playerData.inventory = testInventoryUpdate;
        if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_inventory_data_updated  + ` `) + chalk.green(`${JSON.stringify(testInventoryUpdate)}`));
    }


    return newGameState;
}

async function saveGame(gameState) {
    fs.writeFileSync('./game_save.json', JSON.stringify(gameState));
    if (enableAIDebug) console.log(chalk.green(translateTextTable.game_saved));
}
async function loadGame() {
    if (fs.existsSync('./game_save.json')) {
        const savedData = fs.readFileSync('./game_save.json', 'utf8');
        return JSON.parse(savedData);
    } else {
        return null;
    }
}

function displaySaveInfo(savedGameState) {
    console.log(chalk.yellow('Save Information:'));
    console.log('###############################################');
    console.log(chalk.yellow('  Game Settings:'), JSON.stringify(savedGameState.gameSettings));
    console.log(chalk.yellow('  Player Name:'), savedGameState.playerData.username);
    console.log(chalk.yellow('  Player Description:'), savedGameState.playerData.description);
    console.log(chalk.yellow('  Story Summary:'), savedGameState.story_summary);

    // Last player choice
    console.log('###############################################');
    console.log(chalk.yellow('  Last Player Choice:'));
    console.log(chalk.yellow('    Narrative:'), savedGameState.current_choice.narrative_text);
    console.log(chalk.yellow('    Choice:'), savedGameState.current_choice.user_choice);
    console.log('###############################################');
    console.log(' ');
}

async function main() {
    await loadOra();
    spinner = await ora(translateTextTable.loading_message).start();
    spinner.stop();
    console.log(chalk.red(`############################`));
    console.log(chalk.red(`## Generate Your Own Game ##`));
    console.log(chalk.red(`############################`));

    const savedGameState = await loadGame();
    let loadSavedGame = false;

    if (savedGameState) {
        displaySaveInfo(savedGameState);
        const loadSaveQuestion = await getUserInput(translateTextTable.load_save_question + ' (y/n)', 'n');
        loadSavedGame = (loadSaveQuestion == 'yes' || loadSaveQuestion == 'y') ? true : false;
    }

    if (loadSavedGame) {
        gameState = savedGameState;
        if (gameState.gameSettings.gameLanguage != 'en') {
            const translateMenuAsk = await getUserInput(translateTextTable.translating_menu_question + ' (y/n)', 'n');
            translateMenu = (translateMenuAsk == 'yes' || translateMenuAsk == 'y') ? true : false;
            if (translateMenu) await TranslateMenuText(gameState.gameSettings.gameLanguage);
        }
        choosenLanguage = gameState.gameSettings.gameLanguage;
        firstBoot = false;
    } else {
        let prompt = fs.readFileSync('./prompt/game_prompt.txt', 'utf8');
        const gameLanguage = await getUserInput('Choose the language of the game (en, fr, etc.)', 'en');
        if (gameLanguage != 'en') 
        {
            const translateMenuAsk = await getUserInput(translateTextTable.translating_menu_question  + ' (y/n)', 'n');
            translateMenu = (translateMenuAsk == 'yes' || translateMenuAsk == 'y') ? true : false;
            if (translateMenu) await TranslateMenuText(gameLanguage);
        }
        choosenLanguage = gameLanguage;
        const username = await getUserInput(translateTextTable.choose_player_username, 'Jack');
        const gameEnvironment = await getUserInput(translateTextTable.choose_game_environment, translateTextTable.choose_game_environment_default);
        const playerScenario = await getUserInput(translateTextTable.choose_player_scenario, '');
        const gameDifficulty = await getUserInput(translateTextTable.choose_game_difficulty, translateTextTable.choose_game_difficulty_default);
        const playerSex = await getUserInput(translateTextTable.choose_player_sex, translateTextTable.choose_player_sex_default);
        const description = await getUserInput(translateTextTable.choose_player_description, translateTextTable.choose_player_description_default);
    
        let player;
        let Welcome = `\n${translateTextTable.welcome_game} `.replace('[username]', username);
        console.log(chalk.green(Welcome));
    
        gameState = {
            gameTextHistory: [],
            current_choice: null,
            gameSettings: {
                gameEnvironment: gameEnvironment,
                gameDifficulty: gameDifficulty,
                gameLanguage: gameLanguage
            },
        };
    
        const playerClass = await getValidClass(gameState, description, playerSex);
    
        player = {
            username,
            class: playerClass,
            sex: playerSex,
            playerDescription: description,
            ...await initializePlayerAttributes(gameState, playerClass, playerSex, description),
        };
        let baseScenario;
    
        baseScenario = await generateGameScenario(gameState, player, playerScenario);
    
        console.log(chalk.green(`\n${translateTextTable.scenario_title}: `) + chalk.blue(`${baseScenario}`) + `\n`);
        gameState = {
            gameTextHistory: [],
            story_summary: baseScenario,
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
                attributes: [
                    { name: "strength", value: player.strength },
                    { name: "dexterity", value: player.dexterity },
                    { name: "constitution", value: player.constitution },
                    { name: "intelligence", value: player.intelligence },
                ],
                special_attributes: player.special_attributes_list,
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
        
        let startInventoryUpdate;
        do {
            startInventoryUpdate = await updatePlayerDataIfNeeded(gameState, baseScenario);
        } while (startInventoryUpdate.playerData.inventory.length === 0);
        await showNewItemsAndStats(startInventoryUpdate, gameState);
        
        gameState = syncInventoryAndStats(startInventoryUpdate, gameState);
    }



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
            } else {
                const narrativeTextRequest = await generateNarrativeText(gameState);
                narrativeText = narrativeTextRequest.next_narrative_text;
                gameOver = narrativeTextRequest.game_over;
                console.log(`\n${translateTextTable.scenario_narrative} ` + chalk.cyan(narrativeText));
                updateInventory = narrativeTextRequest.needPlayerUpdate || narrativeTextRequest.needInventoryUpdate || narrativeTextRequest.needLocationUpdate || narrativeTextRequest.needQuestUpdate || (gameState.playerData.inventory == null || gameState.playerData.inventory.length == 0);
                if (updateInventory) {
                    updatedInventoryStats = await updatePlayerDataIfNeeded(gameState, narrativeText, narrativeTextRequest);
                } else {
                    if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_dont_need_update_player));
                }
                spinner.stop();
            }


        } catch (error) {
            spinner.stop(); 
            console.log(error);
            // Exit the game
            process.exit();
        }
        if (updateInventory) {
            if (!updatedInventoryStats.playerData || !updatedInventoryStats.playerData.inventory || !updatedInventoryStats.playerData.inventory[0] || !updatedInventoryStats.playerData.inventory[0].name) {
                if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_incorrect_player_data_regenerate));
                continue;
            }
            await showNewItemsAndStats(updatedInventoryStats, gameState);
        }
        if (!firstBoot) {
            const acceptIAAnswer = await getUserInput(chalk.magenta(translateTextTable.accept_ia_answer + ' (y/n) '), 'y');
            if (acceptIAAnswer.toLowerCase() != 'y') {
                console.log(' ');
                continue;
            }
        }

        if (updateInventory) gameState = syncInventoryAndStats(updatedInventoryStats, gameState);
        
        const possibleChoices = await generatePossibleChoices(gameState, narrativeText);
        let userInput;
        // Check if possible choices is an object or an array
        if (possibleChoices && (Array.isArray(possibleChoices) || typeof possibleChoices === 'object') && possibleChoices.length > 0) {
            possibleChoices.forEach((choice, index) => {
                console.log(chalk.yellow(`${index + 1}: ${choice}`));
            });
            userInput = await getUserInput(chalk.magenta(translateTextTable.select_player_action));
            userInput = userInput >= 1 && userInput <= possibleChoices.length ? possibleChoices[userInput - 1] : userInput;
        } else {
            console.log(chalk.yellow(translateTextTable.no_possible_choice));
            userInput = await getUserInput(chalk.magenta(translateTextTable.select_player_action_custom));
        }
        await createSummaryTextHistory(gameState);
        console.log(' ');
    
        if (currentChoice) {
            gameState.gameTextHistory.push({
                narrative_text: currentChoice.narrative_text,
                user_choice: currentChoice.user_choice,
            });
        }
		

		gameState.current_choice = {
			narrative_text: narrativeText,
			user_choice: userInput,
		};

        if (gameState.gameTextHistory.length > 5) {
            gameState.gameTextHistory.shift();
        }
        if (firstBoot) firstBoot = false;
        await saveGame(gameState);

        if (gameOver) {
            break;
        }
    }

    rl.close();
}
main();