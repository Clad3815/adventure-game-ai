const readline = require('readline');
const {
    createAiFunctionInstance
} = require('../ai-function-helper/src/aiFunction');
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


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});


async function getUserInput(prompt, defaultInput = '') {
    prompt = chalk.yellow(prompt.trim());
    if (defaultInput != '') prompt = prompt + chalk.blue(` [${defaultInput}] : `);
    else prompt = prompt + ' : ';
    return new Promise((resolve) => {
        rl.question(prompt, (input) => {
            if (defaultInput != '' && input == '') {
                input = defaultInput;
            }
            resolve(input);
        });
    });
}

async function shortenSentence(sentence) {
    spinner = await ora("Shortening sentence ...").start();
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
    spinner = await ora(translateTextTable.create_summary_text_history).start();
    spinner.start();
    let aiData = await aiFunction({
        args: {
            text_history: gameState.gameTextHistory,
        },
        functionName: "create_summary_text_history",
        description: `Create a summary from a text history. The "text_history" argument contain a list of narrative_text with the player answer to the text. The goal is to summarize the history to a little text which explain all important point. The final text must contain maximum 100 words And must keep all important informations, the sentence need to be shortest possible the text is not designed to be display it's just a reminder for the AI. Example: 
"Jack went to the market to buy a sword, after that he go back to home and sleep very well" to 
"Jack go market buy sword, go home, sleep"`,
        funcReturn: "str",
        // showDebug: true,
        showDebug: enableDebug,
        temperature: 1,
    });
    spinner.stop();
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
        funcReturn: "dict[hp: dict[current: int, max: int], mana: dict[current: int, max: int], money: int, money_currency: str, strength: int, intelligence: int, dexterity: int, constitution: int, special_attributes_list: list[str]]",
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
        temperature: 0.9,
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
    let narrative_history = gameState.previous_narrative.slice(0, gameState.previous_narrative.length - 1);
    let args = {
        last_narrative_text: gameState.previous_narrative[gameState.previous_narrative.length - 1].narrative_text,
        current_player_answer: gameState.previous_narrative[gameState.previous_narrative.length - 1].player_answer,
        past_narrative_history: narrative_history,
        playerData: gameState.playerData,
        playerLocation: gameState.playerLocation,
        playerQuest: gameState.playerQuest,
        playerInventory: gameState.playerInventory,
        gameSettings: gameState.gameSettings,
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
        funcReturn: "dict[next_narrative_text:str, playerUpdateList: list[dict[stat:str, value:str]], inventoryUpdateList: list[toAdd: list[dict], toRemove: list[dict], toUpdate: list[dict]], locationUpdateText:str, questUpdateText: str, isGameOver:bool]",
        // showDebug: true,
        showDebug: enableDebug,
        temperature: 0.9,
        // presence_penalty: 0.6,
        // frequency_penalty: 0.6,
        top_p: 1,
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
        let prompt = fs.readFileSync('./prompt/multi_prompt/generate_game_from_player_scenario.txt', 'utf8');
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
            description: prompt,
            funcReturn: "str",
            showDebug: enableDebug,
            temperature: 1,
            presence_penalty: 0.6,
            frequency_penalty: 0.6,
        });
        spinner.stop();
    } else {

        // Read the prompt from the file
        let prompt = fs.readFileSync('./prompt/multi_prompt/generate_game_scenario.txt', 'utf8');
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
            description: prompt,
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
            playerLocation: gameState.playerLocation,
            playerQuest: gameState.playerQuest,
            playerInventory: gameState.playerInventory,
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
    if (updatedInventoryStats.playerInventory) {
        gameState.playerInventory = updatedInventoryStats.playerInventory;
    }
    if (updatedInventoryStats.playerData.hp.current) {
        gameState.playerData.hp.current = updatedInventoryStats.playerData.hp.current;
    }
    if (updatedInventoryStats.playerData.hp.max) {
        gameState.playerData.hp.max = updatedInventoryStats.playerData.hp.max;
    }
    if (updatedInventoryStats.playerData.money) {
        gameState.playerData.money = updatedInventoryStats.playerData.money;
    }
    if (updatedInventoryStats.playerData.mana.current) {
        gameState.playerData.mana.current = updatedInventoryStats.playerData.mana.current;
    }
    if (updatedInventoryStats.playerData.mana.max) {
        gameState.playerData.mana.max = updatedInventoryStats.playerData.mana.max;
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

    if (updatedInventoryStats.playerLocation) {
        gameState.playerLocation = updatedInventoryStats.playerLocation;
    }

    if (updatedInventoryStats.playerQuest) {
        gameState.playerQuest = updatedInventoryStats.playerQuest;
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
            logIfChanged(oldPlayer.hp.current, newPlayer.hp.current, `${translateTextTable.player_hp_change} ${newPlayer.hp.current}/${oldPlayer.hp.max}`, `${translateTextTable.player_interface_value_change}: ${newPlayer.hp.current - oldPlayer.hp.current}`),
            logIfChanged(oldPlayer.mana.current, newPlayer.mana.current, `${translateTextTable.player_mana_change} ${newPlayer.mana.current}/${oldPlayer.mana.max}`, `${translateTextTable.player_interface_value_change}: ${newPlayer.mana.current - oldPlayer.mana.current}`),
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

    const newLocation = updatedInventoryStats.playerLocation;
    const oldLocation = gameState.playerLocation;
    const locationItems = [];

    if (newLocation) {
        [
            logIfChanged(oldLocation.location_name, newLocation.location_name, `${translateTextTable.player_location_change} ${newLocation.location_name}`),
            logIfChanged(oldLocation.location_short_reason, newLocation.location_short_reason, `${translateTextTable.player_location_reason} ${newLocation.location_short_reason}`),
            logIfChanged(oldLocation.location_type, newLocation.location_type, `${translateTextTable.player_location_type} ${newLocation.location_type}`),
            logIfChanged(oldLocation.room_name, newLocation.room_name, `${translateTextTable.player_location_sublocation} ${newLocation.room_name}`)
        ].forEach(item => {
            if (item !== null) {
                locationItems.push(item);
            }
        });
    }

    if (locationItems.length > 0) {
        printCategory('Location', locationItems);
    }

    const newQuest = updatedInventoryStats.playerQuest;
    const oldQuest = gameState.playerQuest;
    const questItems = [];

    if (newQuest) {
        [
            logIfChanged(oldQuest.quest_name, newQuest.quest_name, `${translateTextTable.player_new_quest} ${newQuest.quest_name}`),
            logIfChanged(oldQuest.quest_description, newQuest.quest_description, `${translateTextTable.player_quest_description} ${newQuest.quest_description}`),
            logIfChanged(oldQuest.quest_status, newQuest.quest_status, `${translateTextTable.player_quest_status} ${newQuest.quest_status}`),
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

    // Added: Display quest steps
    if (newQuest && newQuest.quest_step_list && newQuest.quest_step_list.length > 0) {
        const questStepsItems = [];

        newQuest.quest_step_list.forEach((step, index) => {
            const oldStep = oldQuest.quest_step_list && oldQuest.quest_step_list[index] ? oldQuest.quest_step_list[index] : {};

            [
                logIfChanged(oldStep.id, step.id, `Step ID: ${step.id}`),
                logIfChanged(oldStep.step_name, step.step_name, `Step Name: ${step.step_name}`),
                logIfChanged(oldStep.step_goal, step.step_goal, `Step Goal: ${step.step_goal}`),
                logIfChanged(oldStep.step_status, step.step_status, `Step Status: ${step.step_status ? 'Completed' : 'Incomplete'}`)
            ].forEach(item => {
                if (item !== null) {
                    questStepsItems.push(item);
                }
            });
        });

        if (questStepsItems.length > 0) {
            printCategory('Quest Steps', questStepsItems);
        }
    }

    if (updatedInventoryStats.playerData && updatedInventoryStats.playerInventory) {
        let newItems = [];
        let removedItems = [];
        let inventory = updatedInventoryStats.playerInventory;
        let oldInventory = gameState.playerInventory;
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

async function generateStarterInventory(gameState, narrativeText) {
    let prompt = fs.readFileSync('./prompt/multi_prompt/generate_starter_inventory.txt', 'utf8');
    let args = {
        narrativeText: narrativeText,
        gameSettings: gameState.gameSettings,
    };
    if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_inventory_data_update + ` `) + chalk.green(`${JSON.stringify(args)}`));
    spinner = await ora(translateTextTable.update_player_inventory).start();
    spinner.start();
    aiData = await aiFunction({
        args: args,
        functionName: "generate_player_inventory",
        description: prompt,
        funcReturn: "dict[weapons: dict[id: int, name:str, count:int, attack: int, type:str, money_value:int, ammo: dict[type: str, count: int, max: int], equipped:bool],armor: dict[id: int, name:str, count:int, defense: int, type:str, money_value:int, equipped:bool], items: dict[id: int, name:str, count:int, type:str, money_value:int]]",
        showDebug: enableDebug,
        temperature: 0.9,
    });
    spinner.stop();
    if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_inventory_data_updated + ` `) + chalk.green(`${JSON.stringify(aiData)}`));
    if (aiData && aiData.weapons) {
        return aiData;
    } else {
        if (enableAIDebug) console.log(translateTextTable.ai_invalid_return + JSON.stringify(aiData));
        return generateStarterInventory(gameState, narrativeText);
    }
}

async function updatePlayerInventory(gameState, narrativeTextRequest) {
    let prompt = fs.readFileSync('./prompt/multi_prompt/update_player_inventory.txt', 'utf8');
    let args = {
        playerInventory: gameState.playerInventory,
        narrativeText: narrativeTextRequest.next_narrative_text,
        itemToAdd: narrativeTextRequest.inventoryUpdateList.toAdd,
        itemToRemove: narrativeTextRequest.inventoryUpdateList.toRemove,
        itemToUpdate: narrativeTextRequest.inventoryUpdateList.toUpdate,
        gameSettings: gameState.gameSettings,
    };
    if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_inventory_data_update + ` `) + chalk.green(`${JSON.stringify(args)}`));
    spinner = await ora(translateTextTable.update_player_inventory).start();
    spinner.start();
    aiData = await aiFunction({
        args: args,
        functionName: "update_player_inventory",
        description: prompt,
        funcReturn: "dict[weapons: dict[id: int, name:str, count:int, attack: int, type:str, money_value:int, ammo: dict[type: str, count: int, max: int], equipped:bool],armor: dict[id: int, name:str, count:int, defense: int, type:str, money_value:int, equipped:bool], items: dict[id: int, name:str, count:int, type:str, money_value:int]]",
        showDebug: enableDebug,
        temperature: 0.7,
    });
    spinner.stop();
    if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_inventory_data_updated + ` `) + chalk.green(`${JSON.stringify(aiData)}`));
    if (aiData && aiData.weapons) {
      return aiData;
    } else {
        if (enableAIDebug) console.log(translateTextTable.ai_invalid_return + JSON.stringify(aiData));
        return updatePlayerInventory(gameState, narrativeTextRequest);
    }
}

async function updatePlayerStats(gameState, narrativeTextRequest) {
    let prompt = fs.readFileSync('./prompt/multi_prompt/update_player_data.txt', 'utf8');
    let args = {
        playerData: {
            hp: gameState.playerData.hp,
            mana: gameState.playerData.mana,
            money: gameState.playerData.money,
            money_currency: gameState.playerData.money_currency,
            exp: gameState.playerData.exp,
            level: gameState.playerData.level,
            next_level_exp: gameState.playerData.next_level_exp,
            strength: gameState.playerData.attributes.strength,
            intelligence: gameState.playerData.attributes.intelligence,
            dexterity: gameState.playerData.attributes.dexterity,
            constitution: gameState.playerData.attributes.constitution,
        },
        narrativeText: narrativeTextRequest.next_narrative_text,
        playerUpdateList: narrativeTextRequest.playerUpdateList,
        gameSettings: gameState.gameSettings,
    };
    if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_stats_data_update + ` `) + chalk.green(`${JSON.stringify(args)}`));
    spinner = await ora(translateTextTable.update_player_stats).start();
    spinner.start();
    
    aiData = await aiFunction({
        args: args,
        functionName: "update_player_stats",
        description: prompt,
        funcReturn: "dict[hp: dict[current: int, max: int], mana: dict[current: int, max: int], money: int, strength: int, intelligence: int, dexterity: int, constitution: int, exp: int, level: int, next_level_exp: int]",
        showDebug: enableDebug,
        temperature: 0.4,
    });
    spinner.stop();
    if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_stats_data_updated + ` `) + chalk.green(`${JSON.stringify(aiData)}`));
    return aiData;
}

async function updatePlayerQuest(gameState, narrativeTextRequest) {
    let prompt = fs.readFileSync('./prompt/multi_prompt/update_player_quest.txt', 'utf8');
    let args = {
        questData: gameState.playerQuest,
        narrativeText: narrativeTextRequest.next_narrative_text,
        questUpdateText: narrativeTextRequest.questUpdateText,
        gameSettings: gameState.gameSettings,
    };
    if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_quest_data_update + ` `) + chalk.green(`${JSON.stringify(args)}`));
    spinner = await ora(translateTextTable.update_player_quest).start();
    spinner.start();
    aiData = await aiFunction({
        args: args,
        functionName: "update_player_quest",
        description: prompt,
        funcReturn: "dict[quest_name: str, quest_description: str, quest_status: str, quest_step_list: list[dict[id: int, step_name: str, step_goal: str, step_status:bool]], quest_reward: str]",
        showDebug: enableDebug,
        temperature: 0.7,
    });
    spinner.stop();
    if (aiData != null && typeof aiData === 'object' && aiData.quest_name) {
        if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_quest_data_updated + ` `) + chalk.green(`${JSON.stringify(aiData)}`));
        return aiData;
    } else {
        if (enableAIDebug) console.log(translateTextTable.ai_invalid_return + JSON.stringify(aiData));
        return updatePlayerQuest(gameState, narrativeTextRequest);
    }
}

async function updatePlayerLocation(gameState, narrativeTextRequest) {
    let prompt = fs.readFileSync('./prompt/multi_prompt/update_player_location.txt', 'utf8');
    let args = {
        location: gameState.playerLocation,
        narrativeText: narrativeTextRequest.next_narrative_text,
        locationUpdateText: narrativeTextRequest.locationUpdateText,
        gameSettings: gameState.gameSettings,
    };
    if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_location_data_update + ` `) + chalk.green(`${JSON.stringify(args)}`));
    spinner = await ora(translateTextTable.update_player_location).start();
    spinner.start();
    aiData = await aiFunction({
        args: args,
        functionName: "update_player_location",
        description: prompt,
        funcReturn: "dict[location_name: str, location_short_reason: str, location_type: str, room_name: str]",
        showDebug: enableDebug,
        temperature: 0.7,
    });
    spinner.stop();
    if (enableAIDebug) console.log(chalk.red(translateTextTable.debug_send_location_data_updated + ` `) + chalk.green(`${JSON.stringify(aiData)}`));
    return aiData;
}

async function updatePlayerDataIfNeeded(gameState, narrativeText, narrativeTextRequest = false) {
    let newGameState = JSON.parse(JSON.stringify(gameState));

    if (narrativeTextRequest && narrativeTextRequest.playerUpdateList && narrativeTextRequest.playerUpdateList.length > 0) {
        let testPlayerUpdate = await updatePlayerStats(newGameState, narrativeTextRequest);
        newGameState.playerData.hp = testPlayerUpdate.hp;
        newGameState.playerData.mana = testPlayerUpdate.mana;
        newGameState.playerData.money = testPlayerUpdate.money;
        newGameState.playerData.exp = testPlayerUpdate.exp;
        newGameState.playerData.level = testPlayerUpdate.level;
        newGameState.playerData.next_level_exp = testPlayerUpdate.next_level_exp;
        newGameState.playerData.attributes.strength = testPlayerUpdate.strength;
        newGameState.playerData.attributes.intelligence = testPlayerUpdate.intelligence;
        newGameState.playerData.attributes.dexterity = testPlayerUpdate.dexterity;
        newGameState.playerData.attributes.constitution = testPlayerUpdate.constitution;
    }

    if (narrativeTextRequest && narrativeTextRequest.locationUpdateText) {
        let testLocationUpdate = await updatePlayerLocation(newGameState, narrativeTextRequest);
        newGameState.playerLocation = testLocationUpdate;
    }
    
    if (narrativeTextRequest && narrativeTextRequest.questUpdateText) {
        let testQuestUpdate = await updatePlayerQuest(newGameState, narrativeTextRequest);
        newGameState.playerQuest = testQuestUpdate;
    }

    if (narrativeTextRequest && narrativeTextRequest.inventoryUpdateList && ((narrativeTextRequest.inventoryUpdateList.toAdd && narrativeTextRequest.inventoryUpdateList.toAdd.length > 0) || (narrativeTextRequest.inventoryUpdateList.toRemove && narrativeTextRequest.inventoryUpdateList.toRemove.length > 0) || (narrativeTextRequest.inventoryUpdateList.toUpdate && narrativeTextRequest.inventoryUpdateList.toUpdate.length > 0))) {
        let testInventoryUpdate = await updatePlayerInventory(newGameState, narrativeTextRequest);
        if (testInventoryUpdate.length > 0) newGameState.playerInventory = testInventoryUpdate;
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
    // console.log(chalk.yellow('  Story Summary:'), savedGameState.story_summary);

    // Last player choice
    console.log('###############################################');
    console.log(chalk.yellow('  Last Player Choice:'));
    console.log(chalk.yellow('    Narrative:'), savedGameState.previous_narrative[savedGameState.previous_narrative.length - 1].narrative_text);
    console.log(chalk.yellow('    Choice:'), savedGameState.previous_narrative[savedGameState.previous_narrative.length - 1].player_answer);
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
        if (gameState.gameSettings.gameLanguage != 'en' && !translateMenu) {
            const translateMenuAsk = await getUserInput(translateTextTable.translating_menu_question + ' (y/n)', 'y');
            translateMenu = (translateMenuAsk == 'yes' || translateMenuAsk == 'y') ? true : false;
            if (translateMenu) await TranslateMenuText(gameState.gameSettings.gameLanguage);
        }
        firstBoot = false;
    } else {
        let prompt = fs.readFileSync('./prompt/game_prompt.txt', 'utf8');
        const gameLanguage = await getUserInput('Choose the language of the game (en, fr, etc.)', 'en');
        if (gameLanguage != 'en') 
        {
            const translateMenuAsk = await getUserInput(translateTextTable.translating_menu_question  + ' (y/n)', 'y');
            translateMenu = (translateMenuAsk == 'yes' || translateMenuAsk == 'y') ? true : false;
            if (translateMenu) await TranslateMenuText(gameLanguage);
        }
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
            previous_narrative: [],
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
            // story_summary: await shortenSentence(baseScenario),
            previous_narrative: [],
            playerData: {
                hp: player.hp,
                money: player.money,
                money_currency: player.money_currency,
                mana: player.mana,
                exp: 0,
                next_level_exp: 100,
                level: 1,
                class: player.class,
                sex: player.sex,
                username: player.username,
                description: player.playerDescription,
                attributes: {
                    strength: player.strength,
                    dexterity: player.dexterity,
                    constitution: player.constitution,
                    intelligence: player.intelligence,
                },
                special_attributes: player.special_attributes_list,
            },
            playerInventory: [],
            playerLocation: {
                "location_name": "",
                "location_short_reason": "",
                "location_type": "",
                "room_name": "",
            },
            playerQuest: {
                "quest_name": "No Quest",
                "quest_description": "Find a quest to start your adventure !",
                "quest_status": "Not Started",
                "quest_step_list": [],
                "quest_reward": ""
            },
            gameSettings: {
                gameEnvironment: gameEnvironment,
                gameDifficulty: gameDifficulty,
                gameLanguage: gameLanguage
            },
        };
        
        let startInventoryUpdate = await updatePlayerDataIfNeeded(gameState, baseScenario);
        startInventoryUpdate.playerInventory = await generateStarterInventory(startInventoryUpdate, baseScenario);
       
        await showNewItemsAndStats(startInventoryUpdate, gameState);
        
        gameState = syncInventoryAndStats(startInventoryUpdate, gameState);
    }



    while (true) {
        let updatedInventoryStats = null;
        let narrativeText;
        let updateInventory = false;
        let gameOver;
        try {
            if (firstBoot) {
                narrativeText = baseScenario;
            } else {
                const narrativeTextRequest = await generateNarrativeText(gameState);
                narrativeText = narrativeTextRequest.next_narrative_text;
                gameOver = narrativeTextRequest.game_over;
                console.log(`\n${translateTextTable.scenario_narrative} ` + chalk.cyan(narrativeText));
                updatedInventoryStats = await updatePlayerDataIfNeeded(gameState, narrativeText, narrativeTextRequest);
                await showNewItemsAndStats(updatedInventoryStats, gameState);
                spinner.stop();
            }


        } catch (error) {
            spinner.stop(); 
            console.log(error);
            // Exit the game
            process.exit();
        }
        if (gameOver) {
            console.log(chalk.red(translateTextTable.game_over));
            process.exit();
        }
        if (!firstBoot) {
            const acceptIAAnswer = await getUserInput(chalk.magenta(translateTextTable.accept_ia_answer + ' (y/n) '), 'y');
            if (acceptIAAnswer.toLowerCase() != 'y') {
                console.log(' ');
                continue;
            }
        }
        if (updatedInventoryStats) {
            gameState = syncInventoryAndStats(updatedInventoryStats, gameState);
        }
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
        // await createSummaryTextHistory(gameState);
        console.log(' ');
    
		let data = {
            narrative_text: narrativeText,
            player_answer: userInput,
		};
		gameState.gameTextHistory.push(data);
		gameState.previous_narrative.push(data);


        if (gameState.previous_narrative.length > 5) {
            gameState.previous_narrative.shift();
        }
        if (firstBoot) firstBoot = false;
        await saveGame(gameState);

    }

    rl.close();
}
main();