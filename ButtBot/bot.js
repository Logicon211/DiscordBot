var Discord = require('discord.io');
var _ = require('underscore');
var logger = require('winston');
var auth = require('./auth.json');
var config = require('./config');
var fs = require('fs');
var Commands = require('./lib/commands').Commands;
var stats = require('./lib/stats');
var options = require('./lib/options');
var Hypher = require('hypher');
var english = require('hyphenation.en-us');
var validUrl = require('valid-url');
var h = new Hypher(english);
var stopwords = [];

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
	log("info", "Welcome to ButtBot (Discord Edition)");
    log("info", "Remember! Isaac Buttimov's First Rule of Buttbotics: Don't let buttbot reply to buttbot.");
	
	// Load all the stop words from file
    stopwords = fs.readFileSync('./lib/stopwords').toString().split(/\r\n?|\n/);
    log("debug", "Stop words loaded", stopwords);
	
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
	
	log("info", "Bot connected successfully." );
    stats.init(this);
    options.init(this);
});
bot.on('message', function (user, userID, channelID, message, evt) {
   
	if (config.bot.enableCommands && message.charAt(0) == config.bot.commandPrefix) {
            handleBotCommand(message);
            return;
    }

	console.log(bot.id + " And user ID: " + userID);
    if ((config.breakTheFirstRuleOfButtbotics || bot.id != userID)/* && (!options.getOption(message.channel.server, "muted") && !_.contains(options.getOption(message.channel.server, "mutedChannels"), channelID))*/) {
		console.log("blah lbas");
		var chance = Math.random();
		console.log(chance);
		if (chance < config.chanceToButt) {
			console.log("In here now");
			buttify(message, function(err, msg) {
				console.log(err);
				console.log(msg);
				if (!err.failed) {
					//rclient.set("server:lock:" + message.channel.server.id, config.buttBuffer);
					bot.sendMessage({
						to: channelID,
						message: msg
					});
					//not sure how to fix stats for now
					//stats.setStat(message.channel.server, "buttifyCount", parseInt(stats.getStat(message.channel.server, "buttifyCount")) + 1);
					//stats.setGlobalStat("buttifyCount", parseInt(stats.getGlobalStat("buttifyCount")) + 1)
				}
			});
		}
	}


	//Example code
   // Our bot needs to know if it will execute a command
   // It will listen for messages that will start with `!`
   /*  if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
       
        args = args.splice(1);
        switch(cmd) {
            // !ping
            case 'ping':
                bot.sendMessage({
                    to: channelID,
                    message: 'Pong!'
                });
            break;
            // Just add any case commands if you want to..
         }
     } */
});

function handleBotCommand(message) {
    message.content = message.content.substr(1);

    var chunks = message.content.split(" ");
    var command = chunks[0];
    var params = chunks.slice(1);

    if (Commands[command]) {
        var user = message.author;

		//Figure out how to get user authority here
        //authority.getUserLevel(message.channel.server, user, function(err, level) {
            //if (level >= Commands[command].authLevel) {
                Commands[command].fn(buttBot, params, message);
            //} else {
            //    buttBot.reply(message, "you do not have access to this command!");
            //}
       // });

    }
}

function buttify(string, callback) {
  var originalString = string;
  var buttdex = [];
  var err = {};

  // Separate the string into an array
  var split = prepareForButtification(string);

  if (split.length < config.minimumWordsBeforeButtification) {
      err = {"failed": true, "msg": "Not enough words to buttify"};
      return callback(err);
  }

  log("debug", "Test Hyphenation", h.hyphenateText(string));

  // Choose words to buttify. Super simple here. Just chance to select random
  // words from the string. Eventually we want to weight them and pick them
  // that way but for now this will work.
  //
  // As of now we use wordsToPossiblyButt as a factor for buttification chance.
  // If a sentance has 9 words it will be divided by the chance to possibly butt
  // and has 3 chances to have butts in it. This means sentances shorter
  // than the chance to butt will never be buttified.
  //
  // We also check to make sure this index hasn't been buttified already!
  for (x=0;x < (Math.floor(Math.random()*(Math.floor(split.length / config.wordsToPossiblyButt))) + 1); x++) {
      var rndIndex = Math.floor(Math.random()*split.length);
      var word = split[rndIndex];

      if (!_.contains(buttdex, rndIndex)) {
          split[rndIndex] = subButt(word);
          buttdex.push(rndIndex);
      }

  }
  // Replace words and compare to original string. Determine butting
  // threshold. Did we butt too much? Abandon all hope.

  // Make sure it doesnt match original input string. We had to have
  // buttified at least one thing.
  var final = finishButtification(split);

  if (!didWeActuallyButt(originalString, final)) {
      err = {"failed": true, "msg": "We didn't buttify anything! Abort!"};
  }

  // Output
  return callback(err, final);
}

function subButt(word) {
    var ogWord = word;
    var buttWord = config.meme;

    var punc = word.match(/^([^A-Za-z]*)(.*?)([^A-Za-z]*)$/);

    var pS = punc[1],
        sWord = punc[2],
        pE = punc[3];

    if (shouldWeButt(sWord)) {
        return ogWord;
    }

    var hyphenated = h.hyphenate(sWord);

    if (sWord === sWord.toUpperCase()) {
        buttWord = buttWord.toUpperCase();
    }

    if (hyphenated.length > 1 ) {
        var swapIndex = Math.floor(Math.random()*hyphenated.length);

        if (swapIndex == 0 && sWord.match(/^[A-Z]/)) {
            buttWord = capitalizeFirstLetter(buttWord);
        }
        hyphenated[swapIndex] = buttWord;

        buttWord = hyphenated.join("");
    } else {
        if (sWord.match(/^[A-Z]/)) {
            buttWord = capitalizeFirstLetter(buttWord);
        }
    }

    return pS + buttWord + pE;
}

/**
 * Did we actually change the string at all?
 *
 * @param  {string} original  Original version of the string
 * @param  {string} newString Possibly buttified version of the string
 * @return {bool}
 */
function didWeActuallyButt(original, newString) {
    if (original == newString) {
        return false;
    }
    return true;
}

/**
 * Separate string in preparation for butiffication
 *
 * @param  {string} string String input
 * @return {array}        Array. Ready to buttify
 */
function prepareForButtification(string) {
  var original = string;

  var trimmed = string.trim();
  var split = trimmed.split(" ");

  return split;
}

/**
 * Rejoin string after done buttifying
 *
 * @param  {Array} split Array of updated string
 * @return {string}
 */
function finishButtification(split) {
    return split.join(" ");
}

/**
 * Capitalize the first letter of a word
 *
 * @param  {string} string Word to capitalize
 * @return {string}
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Determine if word should be butted
 *
 * @param  {string} string  Stripped version of the word
 * @return {bool}
 */
function shouldWeButt(string) {
    // Is the word the same as our meme?
    if (string.toLowerCase() == config.meme) {
        return false;
    }

    // Is the word a stop word?
    if (_.contains(stopwords, string)) {
        return false;
    }

    // Is the word a URL?
    if (validUrl.isUri(string)) {
        return false;
    }

    // Is the word a mention?
    if (string.match(/^@[A-Za-z0-9]/)) {
        return false;
    }

    return true;
}

function log(level, msg, meta) {
	if (config.logging && config.logging != 0) {

		if (meta) {
			logger.log(level, '[ButtJS] ' + msg, meta);
		} else {
			logger.log(level, '[ButtJS] ' + msg);
		}
	}
}
