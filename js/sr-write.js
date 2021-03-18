/* roam/sr - Spaced Repetition in Roam Research
   OG Author: Adam Krivka
   Bastardizer: Charles Farr
   forked from v1.0.1
 */

var VERSION = "v1.0.1";

if (!window.roamsrWrite) window.roamsrWrite = {};

/* ====== SCHEDULERS / ALGORITHMS ====== */

// roamsrWrite.ankiScheduler = function(userConfig) { }
roamsrWrite.ankiScheduler = (userConfig) => {

  // sets default config values for scheduling blocks
  var config = {
    defaultFactor: 2.5,
    firstFewIntervals: [1, 6],
    factorModifier: 0.15,
    easeBonus: 1.3,
    hardFactor: 1.2,
    minFactor: 1.3,
    jitterPercentage: 0.05,
    maxInterval: 50 * 365,
    responseTexts: ["Again", "Fruitful", "Unfruitful"] //, "Easy."]
  }

  // overwrites config with userConfig
  config = Object.assign(config, userConfig);

  // function algorithm (history) {}
    // returns a [ , ]
  var algorithm = (history) => {
    
    var nextInterval;
    
    // if history == true then map(review => review.signal) and select the last item equal to "1"
    // else if history is false, select 0
    var lastFail = history ? history.map(review => review.signal).lastIndexOf("1") : 0;
    
    // set history to the following
      // if history == true then...
        // set to history of slice of history
          // if lastfail == -1 then history else select from slice of history beginning at lastfail + 1
      // if history == false ...
        // set to empty 
      // summary: if history is true, return history since lastFail (either whole or slice)
    history = history ? (lastFail == -1 ? history : history.slice(lastFail + 1)) : [];
    
    // Check if in learning phase
      // if in learning phase, return some Object
      // else return an updated [factor, interval]
    if (history.length == 0 || history.length <= config.firstFewIntervals.length) {
      return [{
        responseText: config.responseTexts[0],
        signal: 1,
        interval: 0
      },
      {
        responseText: config.responseTexts[1],
        signal: 2,
        interval: 3
      },
      {
        responseText: config.responseTexts[2],
        signal: 3,
        interval: config.firstFewIntervals[history ? Math.max(history.length - 1, 0) : 0]
      }];
    } else {
      var calculateNewParams = (prevFactor, prevInterval, delay, signal) => {
        var [newFactor, newInterval] = (() => {
          switch (signal) {
            case "1":
              return [prevFactor - 0.2, 0];
            case "2":
              return [prevFactor - config.factorModifier, prevInterval * config.hardFactor];
            case "3":
              return [prevFactor, (prevInterval + delay / 2) * prevFactor];
            // case "4":
            //   return [prevFactor + config.factorModifier, (prevInterval + delay) * prevFactor * config.easeBonus];
            default:
              return [prevFactor, prevInterval * prevFactor];
          }
        })();
        return [newFactor, Math.min(newInterval, config.maxInterval)];
      };


      var getDelay = (hist, prevInterval) => {
        if (hist && hist.length > 1)
          return Math.max((hist[hist.length - 1].date - hist[hist.length - 2].date) / (1000 * 60 * 60 * 24) - prevInterval, 0);
        else return 0;
      };
      var recurAnki = (hist) => {
        if (!hist || hist.length <= config.firstFewIntervals.length) {
          return [config.defaultFactor, config.firstFewIntervals[config.firstFewIntervals.length - 1]];
        } else {
          var [prevFactor, prevInterval] = recurAnki(hist.slice(0, -1));
          return calculateNewParams(prevFactor, prevInterval, getDelay(hist, prevInterval), hist[hist.length - 1].signal);
        }
      };

      var [finalFactor, finalInterval] = recurAnki(history.slice(0, -1));

      var addJitter = (interval) => {
        var jitter = interval * config.jitterPercentage;
        return interval + (-jitter + Math.random() * jitter)
      }

      var getResponse = (signal) => {
        return {
          responseText: config.responseTexts[parseInt(signal) - 1],
          signal: signal,
          interval: Math.floor(addJitter(calculateNewParams(finalFactor, finalInterval, getDelay(history, finalInterval), signal)[1]))
        }
      }
      return [getResponse("1"), getResponse("2"), getResponse("3")] //, getResponse("4")]
    }
  }
  return algorithm;
};

/* ====== HELPER FUNCTIONS ====== */

roamsrWrite.sleep = m => {
  var t = m ? m : 10;
  return new Promise(r => setTimeout(r, t))
};

roamsrWrite.createUid = () => {
  // From roam42 based on https://github.com/ai/nanoid#js version 3.1.2
  let nanoid = (t = 21) => { let e = "", r = crypto.getRandomValues(new Uint8Array(t)); for (; t--;) { let n = 63 & r[t]; e += n < 36 ? n.toString(36) : n < 62 ? (n - 26).toString(36).toUpperCase() : n < 63 ? "_" : "-" } return e };
  return nanoid(9);
};

roamsrWrite.removeSelector = (selector) => {
  document.querySelectorAll(selector).forEach(element => { element.remove() });
};

roamsrWrite.goToUid = (uid) => {
  var baseUrl = "/" + new URL(window.location.href).hash.split("/").slice(0, 3).join("/");
  var url = uid ? baseUrl + "/page/" + uid : baseUrl;
  location.assign(url);
};

roamsrWrite.getFuckingDate = (str) => {
  if (!str) return null;
  let strSplit = str.split("-");
  if (strSplit.length != 3) return null;
  try {
    let date = new Date(strSplit[2] + "-" + strSplit[0] + "-" + strSplit[1]);
    date.setTime( date.getTime() + date.getTimezoneOffset()*60*1000 )
    return date;
  } catch (e) {
    console.log(e);
  }
};

roamsrWrite.getRoamDate = (date) => {
  if (!date || date == 0) date = new Date();

  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var suffix = ((d) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  })(date.getDate());

  var pad = (n) => n.toString().padStart(2, "0");

  var roamDate = {
    title: months[date.getMonth()] + " " + date.getDate() + suffix + ", " + date.getFullYear(),
    uid: pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "-" + date.getFullYear()
  };

  return roamDate
};

roamsrWrite.getIntervalHumanReadable = (n) => {
  if (n == 0) return "<10 min"
  else if (n > 0 && n <= 15) return n + " d"
  else if (n <= 30) return (n / 7).toFixed(1) + " w"
  else if (n <= 365) return (n / 30).toFixed(1) + " m"
};

/* ====== LOADING CARDS ====== */

roamsrWrite.loadCards = async (limits, dateBasis = new Date()) => {
  // Common functions
  var getDecks = (res) => {
    let recurDeck = (part) => {
      var result = [];
      if (part.refs) result.push(...part.refs)
      if (part._children && part._children.length > 0) result.push(...recurDeck(part._children[0]))
      return result;
    }
    var possibleDecks = recurDeck(res).map(deck => deck.title);
    return possibleDecks.filter(deckTag => roamsrWrite.settings.customDecks.map(customDeck => customDeck.tag).includes(deckTag));
  };

  var getAlgorithm = (res) => {
    let decks = getDecks(res);
    let preferredDeck;
    let algorithm;

    if (decks && decks.length > 0) {
      preferredDeck = roamsrWrite.settings.customDecks.filter(customDeck => customDeck.tag == decks[decks.length - 1])[0];
    } else preferredDeck = roamsrWrite.settings.defaultDeck;

    let scheduler = preferredDeck.scheduler || preferredDeck.algorithm;
    let config = preferredDeck.config;
    if (!scheduler || scheduler === "anki") {
      algorithm = roamsrWrite.ankiScheduler(config);
    } else algorithm = scheduler(config);

    return algorithm;
  };

  var isNew = (res) => {
    return res._refs ? !res._refs.some(review => {
      var reviewDate = new Date(roamsrWrite.getFuckingDate(review.page.uid));
      reviewDate.setDate(reviewDate.getDate() + 1);
      return reviewDate < dateBasis;
    }) : true
  };

  var getHistory = (res) => {
    if (res._refs) {
      return res._refs
        .filter(ref => (ref._children && ref._children[0].refs) ? ref._children[0].refs.map(ref2 => ref2.title).includes("roam/sr/review") : false)
        .map(review => {
          return {
            date: roamsrWrite.getFuckingDate(review.page.uid),
            signal: review.refs[0] ? review.refs[0].title.slice(2) : null,
            uid: review.uid,
            string: review.string
          }
        })
        .sort((a, b) => a.date - b.date)
    } else return []
  };

  // Query for all cards and their history
  var mainQuery = `[
    :find (pull ?card [
      :block/string 
      :block/uid 
      {:block/refs [:node/title]} 
      {:block/_refs [:block/uid :block/string {:block/_children [:block/uid {:block/refs [:node/title]}]} {:block/refs [:node/title]} {:block/page [:block/uid]}]}
      {:block/_children ...}
    ])
    :where 
      [?card :block/refs ?srPage] 
      [?srPage :node/title "${roamsrWrite.settings.mainTag}"] 
      (not-join [?card] 
        [?card :block/refs ?flagPage] 
        [?flagPage :node/title "${roamsrWrite.settings.flagTag}"])
      (not-join [?card] 
        [?card :block/refs ?queryPage] 
        [?queryPage :node/title "query"])
    ]`
  var mainQueryResult = await window.roamAlphaAPI.q(mainQuery);
  var cards = mainQueryResult.map(result => {
    let res = result[0];
    let card = {
      uid: res.uid,
      isNew: isNew(res),
      decks: getDecks(res),
      algorithm: getAlgorithm(res),
      string: res.string,
      history: getHistory(res),
    }
    return card;
  });

  // Query for today's review
  var todayUid = roamsrWrite.getRoamDate().uid;
  var todayQuery = `[
    :find (pull ?card 
      [:block/uid 
      {:block/refs [:node/title]} 
      {:block/_refs [{:block/page [:block/uid]}]}]) 
      (pull ?review [:block/refs])
    :where 
      [?reviewParent :block/children ?review] 
      [?reviewParent :block/page ?todayPage] 
      [?todayPage :block/uid "${todayUid}"] 
      [?reviewParent :block/refs ?reviewPage] 
      [?reviewPage :node/title "roam/sr/review"] 
      [?review :block/refs ?card] 
      [?card :block/refs ?srPage] 
      [?srPage :node/title "${roamsrWrite.settings.mainTag}"]
    ]`
  var todayQueryResult = await window.roamAlphaAPI.q(todayQuery);
  var todayReviewedCards = todayQueryResult
    .filter(result => result[1].refs.length == 2)
    .map(result => {
      let card = {
        uid: result[0].uid,
        isNew: isNew(result[0]),
        decks: getDecks(result[0])
      };
      return card;
    })

  // Filter only cards that are due
  cards = cards.filter(card => card.history.length > 0 ? card.history.some(review => { return (!review.signal && new Date(review.date) <= dateBasis) }) : true);

  // Filter out cards over limit
  roamsrWrite.state.extraCards = [[], []];
  if (roamsrWrite.state.limits) {
    for (deck of roamsrWrite.settings.customDecks.concat(roamsrWrite.settings.defaultDeck)) {

      var todayReviews = todayReviewedCards.reduce((a, card) => {
        if (deck.tag ? card.decks.includes(deck.tag) : card.decks.length == 0) {
          if (!a[2].includes(card.uid)) {
            a[2].push(card.uid);
            a[card.isNew ? 0 : 1]++;
          }
        }
        return a;
      }, [0, 0, []]);

      cards.reduceRight((a, card, i) => {
        if (deck.tag ? card.decks.includes(deck.tag) : card.decks.length == 0) {
          var j = card.isNew ? 0 : 1;
          var limits = [deck.newCardLimit || 0, deck.reviewLimit || 0];
          if (a[j]++ >= limits[j] - todayReviews[j]) {
            roamsrWrite.state.extraCards[j].push(cards.splice(i, 1));
          }
        }
        return a;
      }, [0, 0])
    }
  };

  // Sort (new to front)
  cards = cards.sort((a, b) => a.history.length - b.history.length);
  return cards;
};

/* ====== STYLES ====== */

roamsrWrite.addBasicStyles = () => {
  var style = `
  .roamsr-write-widget__review-button {
    color: #5C7080 !important;
  }
  
  .roamsr-write-widget__review-button:hover {
    color: #F5F8FA !important;
  }
  
  .roamsr-write-return-button-container {
    z-index: 100000;
    margin: 5px 0px 5px 45px;
  }

  .roamsr-write-wrapper {
    pointer-events: none;
    position: relative;
    bottom: 180px;
    justify-content: center;
  }

  .roamsr-write-container {
    width: 100%;
    max-width: 600px;
    justify-content: center;
    align-items: center;
    padding: 5px 20px;
  }

  .roamsr-write-button {
    z-index: 10000;
    pointer-events: all;
  }

  .roamsr-write-response-area {
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 15px;
  }

  .roamsr-write-flag-button-container {
    width: 100%;
  }
  `
  var basicStyles = Object.assign(document.createElement("style"), {
    id: "roamsr-write-css-basic",
    innerHTML: style
  });
  document.getElementsByTagName("head")[0].appendChild(basicStyles);
};

roamsrWrite.setCustomStyle = (yes) => {
  var styleId = "roamsr-write-css-custom"
  var element = document.getElementById(styleId);
  if (element) element.remove();

  if (yes) {
    // Query new style
    var styleQuery = window.roamAlphaAPI.q(
      `[:find (pull ?style [:block/string]) :where [?roamsrWrite :node/title "roam\/sr"] [?roamsrWrite :block/children ?css] [?css :block/refs ?roamcss] [?roamcss :node/title "roam\/css"] [?css :block/children ?style]]`
    );

    if (styleQuery && styleQuery.length != 0) {
      var customStyle = styleQuery[0][0].string.replace("`"+"``css", "").replace("`"+"``", "");

      var roamsrWriteCSS = Object.assign(document.createElement("style"), {
        id: styleId,
        innerHTML: customStyle
      });

      document.getElementsByTagName("head")[0].appendChild(roamsrWriteCSS);
    }
  }
};

roamsrWrite.showAnswerAndCloze = (yes) => {
  var styleId = "roamsr-write-css-mainview"
  var element = document.getElementById(styleId);
  if (element) element.remove();

  if (yes) {
    var clozeStyle = roamsrWrite.settings.clozeStyle || "highlight";
    var style = `
    .roam-article .rm-reference-main,
    .roam-article .rm-block-children
    {
      visibility: hidden;  
    }

    .roam-article .rm-${clozeStyle} {
      background-color: #cccccc;
      color: #cccccc;
    }`

    var basicStyles = Object.assign(document.createElement("style"), {
      id: styleId,
      innerHTML: style
    });
    document.getElementsByTagName("head")[0].appendChild(basicStyles);
  }
};

/* ====== MAIN FUNCTIONS ====== */

roamsrWrite.scheduleCardIn = async (card, interval) => {
  var nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  var nextRoamDate = roamsrWrite.getRoamDate(nextDate);

  // Create daily note if it doesn't exist yet
  await window.roamAlphaAPI.createPage({
    page: {
      title: nextRoamDate.title
    }
  });

  await roamsrWrite.sleep();

  // Query for the [[roam/sr/review]] block
  var queryReviewBlock = window.roamAlphaAPI.q('[:find (pull ?reviewBlock [:block/uid]) :in $ ?dailyNoteUID :where [?reviewBlock :block/refs ?reviewPage] [?reviewPage :node/title "roam/sr/review"] [?dailyNote :block/children ?reviewBlock] [?dailyNote :block/uid ?dailyNoteUID]]', nextRoamDate.uid);

  // Check if it's there; if not, create it
  var topLevelUid;
  if (queryReviewBlock.length == 0) {
    topLevelUid = roamsrWrite.createUid();
    await window.roamAlphaAPI.createBlock({
      location: {
        "parent-uid": nextRoamDate.uid,
        order: 0
      },
      block: {
        string: "[[roam/sr/review]]",
        uid: topLevelUid
      }
    });
    await roamsrWrite.sleep();
  } else {
    topLevelUid = queryReviewBlock[0][0].uid;
  }

  // Generate the block
  var block = {
    uid: roamsrWrite.createUid(),
    string: "((" + card.uid + "))"
  }
  // Finally, schedule the card
  await window.roamAlphaAPI.createBlock({
    location: {
      "parent-uid": topLevelUid,
      order: 0
    },
    block: block
  });
  await roamsrWrite.sleep();

  return {
    date: nextRoamDate.uid,
    signal: null,
    uid: block.uid,
    string: block.string
  };
};

roamsrWrite.responseHandler = async (card, interval, signal) => {
  console.log("Signal: " + signal + ", Interval: " + interval);
  var hist = card.history;

  // If new card, make it look like it was scheduled for today
  if (hist.length == 0 || (hist[hist.length - 1] && hist[hist.length - 1].date !== new Date())) {
    var last = hist.pop();
    if (last) {
      await window.roamAlphaAPI.deleteBlock({
        block: {
          uid: last.uid
        }
      });
    }
    var todayReviewBlock = await roamsrWrite.scheduleCardIn(card, 0);
    hist.push(todayReviewBlock);
  }

  // Record response
  var last = hist.pop();
  last.string = last.string + " #[[r/" + signal + "]]";
  last.signal = signal;
  await window.roamAlphaAPI.updateBlock({
    block: {
      uid: last.uid,
      string: last.string
    }
  })
  hist.push(last);

  // Schedule card to future
  var nextReview = await roamsrWrite.scheduleCardIn(card, interval);
  hist.push(nextReview);

  // If it's scheduled for today, add it to the end of the queue
  if (interval == 0) {
    var newCard = card;
    newCard.history = hist;
    newCard.isNew = false;
    roamsrWrite.state.queue.push(newCard);
  }
};

roamsrWrite.flagCard = () => {
  var card = roamsrWrite.getCurrentCard();
  window.roamAlphaAPI.updateBlock({
    block: {
      uid: card.uid,
      string: card.string + " #" + roamsrWrite.settings.flagTag
    }
  });
  
  var j = roamsrWrite.getCurrentCard().isNew ? 0 : 1;

  var extraCard = roamsrWrite.state.extraCards[j].shift();
  if(extraCard) roamsrWrite.state.queue.push(extraCard);
};

roamsrWrite.stepToNext = async () => {
  if (roamsrWrite.state.currentIndex + 1 >= roamsrWrite.state.queue.length) {
    roamsrWrite.endSession();
  } else {
    roamsrWrite.state.currentIndex++;
    roamsrWrite.goToCurrentCard();
  }
  roamsrWrite.updateCounters();
};

roamsrWrite.goToCurrentCard = async () => {
  window.onhashchange = () => { };
  roamsrWrite.showAnswerAndCloze(true);
  roamsrWrite.removeReturnButton();
  var doStuff = async () => {
    roamsrWrite.goToUid(roamsrWrite.getCurrentCard().uid);
    await roamsrWrite.sleep(50);
    roamsrWrite.addContainer();
    roamsrWrite.addShowAnswerButton();
  }

  await doStuff();
  window.onhashchange = doStuff;

  await roamsrWrite.sleep(500);

  await doStuff();

  window.onhashchange = () => {
    roamsrWrite.removeContainer();
    roamsrWrite.addReturnButton();
    roamsrWrite.showAnswerAndCloze(false);
    window.onhashchange = () => { };
  }
};

/* ====== SESSIONS ====== */

roamsrWrite.loadSettings = () => {
  // Default settings
  roamsrWrite.settings = {
    mainTag: "sr-write",
    flagTag: "sr-flag",
    clozeStyle: "highlight", // "highlight" or "block-ref"
    defaultDeck: {
      algorithm: null,
      config: {},
      newCardLimit: 20,
      reviewLimit: 100,
    },
    customDecks: []
  };
  roamsrWrite.settings = Object.assign(roamsrWrite.settings, window.roamsrWriteUserSettings);
};

roamsrWrite.loadState = async (i) => {
  roamsrWrite.state = {
    limits: true,
    currentIndex: i,
  }
  roamsrWrite.state.queue = await roamsrWrite.loadCards();
  return;
};

roamsrWrite.getCurrentCard = () => {
  var card = roamsrWrite.state.queue[roamsrWrite.state.currentIndex];
  return card ? card : {};
};

roamsrWrite.startSession = async () => {
  if (roamsrWrite.state && roamsrWrite.state.queue.length > 0) {
    console.log("Starting session.");

    roamsrWrite.setCustomStyle(true);

    // Hide left sidebar
    try {
      document.getElementsByClassName("bp3-icon-menu-closed")[0].click();
    } catch (e) { }

    roamsrWrite.loadSettings();
    await roamsrWrite.loadState(0);

    console.log("The queue: ");
    console.log(roamsrWrite.state.queue);

    await roamsrWrite.goToCurrentCard();

    roamsrWrite.addKeyListener();

    // Change widget
    var widget = document.querySelector(".roamsr-write-widget")
    widget.innerHTML = "<div style='padding: 5px 0px'><span class='bp3-icon bp3-icon-cross'></span> END SESSION</div>";
    widget.onclick = roamsrWrite.endSession;
  }
};

roamsrWrite.endSession = async () => {
  window.onhashchange = () => { };
  console.log("Ending sesion.");

  // Change widget
  roamsrWrite.removeSelector(".roamsr-write-widget");
  roamsrWrite.addWidget();

  // Remove elements
  var doStuff = async () => {
    roamsrWrite.removeContainer();
    roamsrWrite.removeReturnButton();
    roamsrWrite.setCustomStyle(false);
    roamsrWrite.showAnswerAndCloze(false);
    roamsrWrite.removeKeyListener();
    roamsrWrite.goToUid();

    await roamsrWrite.loadState(-1);
    roamsrWrite.updateCounters();
  }

  await doStuff();
  await roamsrWrite.sleep(200);
  await doStuff(); // ... again to make sure
  await roamsrWrite.sleep(1000);
  await roamsrWrite.loadState(-1);
  roamsrWrite.updateCounters(); // ... once again
};

/* ====== UI ELEMENTS ====== */

// COMMON
roamsrWrite.getCounter = (deck) => {
  // Getting the number of new cards
  var cardCount = [0, 0];
  if (roamsrWrite.state.queue) {
    var remainingQueue = roamsrWrite.state.queue.slice(Math.max(roamsrWrite.state.currentIndex, 0));
    var filteredQueue = !deck ? remainingQueue : remainingQueue.filter((card) => card.decks.includes(deck));
    cardCount = filteredQueue.reduce((a, card) => {
      if (card.isNew) a[0]++;
      else a[1]++;
      return a;
    }, [0, 0]);
  }

  // Create the element
  var counter = Object.assign(document.createElement("div"), {
    className: "roamsr-write-counter",
    innerHTML: `<span style="color: dodgerblue; padding-right: 8px">` + cardCount[0] + `</span> <span style="color: green;">` + cardCount[1] + `</span>`,
  });
  return counter;
};

roamsrWrite.updateCounters = () => {
  var counter = document.querySelectorAll(".roamsr-write-counter").forEach(counter => {
    counter.innerHTML = roamsrWrite.getCounter().innerHTML;
    counter.style.cssText = !roamsrWrite.state.limits ? "font-style: italic;" : "font-style: inherit;"
  })
};

// CONTAINER
roamsrWrite.addContainer = () => {
  if (!document.querySelector(".roamsr-write-container")) {
    var wrapper = Object.assign(document.createElement("div"), {
      className: "flex-h-box roamsr-write-wrapper"
    })
    var container = Object.assign(document.createElement("div"), {
      className: "flex-v-box roamsr-write-container",
    });

    var flagButtonContainer = Object.assign(document.createElement("div"), {
      className: "flex-h-box roamsr-write-flag-button-container"
    });
    var flagButton = Object.assign(document.createElement("button"), {
      className: "bp3-button roamsr-write-button",
      innerHTML: "Flag",
      onclick: async () => {
        await roamsrWrite.flagCard();
        roamsrWrite.stepToNext();
      }
    });
    var skipButton = Object.assign(document.createElement("button"), {
      className: "bp3-button roamsr-write-button",
      innerHTML: "Skip",
      onclick: roamsrWrite.stepToNext
    });
    flagButtonContainer.style.cssText = "justify-content: space-between;";
    flagButtonContainer.append(flagButton, skipButton);

    var responseArea = Object.assign(document.createElement("div"), {
      className: "flex-h-box roamsr-write-container__response-area"
    });

    container.append(roamsrWrite.getCounter(), responseArea, flagButtonContainer);
    wrapper.append(container);

    var bodyDiv = document.querySelector(".roam-body-main");
    bodyDiv.append(wrapper);
  }
};

roamsrWrite.removeContainer = () => {
  roamsrWrite.removeSelector(".roamsr-write-wrapper");
};

roamsrWrite.clearAndGetResponseArea = () => {
  var responseArea = document.querySelector(".roamsr-write-container__response-area");
  if (responseArea) responseArea.innerHTML = ""
  return responseArea;
};

roamsrWrite.addShowAnswerButton = () => {
  var responseArea = roamsrWrite.clearAndGetResponseArea();

  var showAnswerAndClozeButton = Object.assign(document.createElement("button"), {
    className: "bp3-button roamsr-write-container__response-area__show-answer-button roamsr-write-button",
    innerHTML: "Show answer.",
    onclick: () => { roamsrWrite.showAnswerAndCloze(false); roamsrWrite.addResponseButtons(); }
  })
  showAnswerAndClozeButton.style.cssText = "margin: 5px;";

  responseArea.append(showAnswerAndClozeButton);
};

roamsrWrite.addResponseButtons = () => {
  var responseArea = roamsrWrite.clearAndGetResponseArea();

  // Add new responses
  var responses = roamsrWrite.getCurrentCard().algorithm(roamsrWrite.getCurrentCard().history);
  for (response of responses) {
    const res = response;
    var responseButton = Object.assign(document.createElement("button"), {
      id: "roamsr-write-response-" + res.signal,
      className: "bp3-button roamsr-write-container__response-area__response-button roamsr-write-button",
      innerHTML: res.responseText + "<sup>" + roamsrWrite.getIntervalHumanReadable(res.interval) + "</sup>",
      onclick: async () => {
        if (res.interval != 0) {
          roamsrWrite.responseHandler(roamsrWrite.getCurrentCard(), res.interval, res.signal.toString());
        } else {
          await roamsrWrite.responseHandler(roamsrWrite.getCurrentCard(), res.interval, res.signal.toString());
        }
        roamsrWrite.stepToNext();
      }
    })
    responseButton.style.cssText = "margin: 5px;";
    responseArea.append(responseButton);
  }
};

// RETURN BUTTON
roamsrWrite.addReturnButton = () => {
  var returnButtonClass = "roamsr-write-return-button-container";
  if (document.querySelector(returnButtonClass)) return;

  var main = document.querySelector(".roam-main");
  var body = document.querySelector(".roam-body-main");
  var returnButtonContainer = Object.assign(document.createElement("div"), {
    className: "flex-h-box " + returnButtonClass,
  });
  var returnButton = Object.assign(document.createElement("button"), {
    className: "bp3-button bp3-large roamsr-write-return-button",
    innerText: "Return.",
    onclick: roamsrWrite.goToCurrentCard
  });
  returnButtonContainer.append(returnButton);
  main.insertBefore(returnButtonContainer, body);
};

roamsrWrite.removeReturnButton = () => {
  roamsrWrite.removeSelector(".roamsr-write-return-button-container");
};

// SIDEBAR WIDGET
roamsrWrite.createWidget = () => {
  var widget = Object.assign(document.createElement("div"), {
    className: "log-button flex-h-box roamsr-write-widget",
  });
  widget.style.cssText = "align-items: center; justify-content: space-around; padding-top: 8px;"

  var reviewButton = Object.assign(document.createElement("div"), {
    className: "bp3-button bp3-minimal roamsr-write-widget__review-button",
    innerHTML: `<span style="padding-right: 8px;"><svg width="16" height="16" version="1.1" viewBox="0 0 4.2333 4.2333" style="color:5c7080;">
  <g id="chat_1_" transform="matrix(.26458 0 0 .26458 115.06 79.526)">
    <g transform="matrix(-.79341 0 0 -.88644 -420.51 -284.7)" fill="currentColor">
      <path d="m6 13.665c-1.1 0-2-1.2299-2-2.7331v-6.8327h-3c-0.55 0-1 0.61495-1 1.3665v10.932c0 0.7516 0.45 1.3665 1 1.3665h9c0.55 0 1-0.61495 1-1.3665l-5.04e-4 -1.5989v-1.1342h-0.8295zm9-13.665h-9c-0.55 0-1 0.61495-1 1.3665v9.5658c0 0.7516 0.45 1.3665 1 1.3665h9c0.55 0 1-0.61495 1-1.3665v-9.5658c0-0.7516-0.45-1.3665-1-1.3665z"
        clip-rule="evenodd" fill="currentColor" fill-rule="evenodd" />
    </g>
  </g></svg></span> SR WRITE`,
    //  <span class="bp3-icon bp3-icon-chevron-down expand-icon"></span>`
    onclick: roamsrWrite.startSession
  });
  reviewButton.style.cssText = "padding: 2px 8px;";

  var counter = Object.assign(roamsrWrite.getCounter(), {
    className: "bp3-button bp3-minimal roamsr-write-counter",
    onclick: async () => {
      roamsrWrite.state.limits = !roamsrWrite.state.limits;
      roamsrWrite.state.queue = await roamsrWrite.loadCards();
      roamsrWrite.updateCounters();
    }
  });
  var counterContainer = Object.assign(document.createElement("div"), {
    className: "flex-h-box roamsr-write-widget__counter",
  })
  counterContainer.style.cssText = "justify-content: center; width: 50%";
  counterContainer.append(counter);

  widget.append(reviewButton, counterContainer);

  return widget;
};

roamsrWrite.addWidget = () => {
  if (!document.querySelector(".roamsr-write-widget")) {
    roamsrWrite.removeSelector(".roamsr-write-widget-delimiter")
    var delimiter = Object.assign(document.createElement("div"), {
      className: "roamsr-write-widget-delimiter"
    });
    delimiter.style.cssText = "flex: 0 0 1px; background-color: rgb(57, 75, 89); margin: 8px 20px;";

    var widget = roamsrWrite.createWidget();

    var sidebar = document.querySelector(".roam-sidebar-content");
    var starredPages = document.querySelector(".starred-pages-wrapper");

    sidebar.insertBefore(delimiter, starredPages);
    sidebar.insertBefore(widget, starredPages);
  }
};

/* ====== KEYBINDINGS ====== */
roamsrWrite.processKey = (e) => {
  // console.log("alt: " + e.altKey + "  shift: " + e.shiftKey + "  ctrl: " + e.ctrlKey + "   code: " + e.code + "   key: " + e.key);
  if (document.activeElement.type == "textarea" || !location.href.includes(roamsrWrite.getCurrentCard().uid)) {
    return;
  }

  var responses = roamsrWrite.getCurrentCard().algorithm(roamsrWrite.getCurrentCard().history);
  var handleNthResponse = async (n) => {
    console.log("Handling response: " + n)
    if (n >= 0 && n < responses.length) {
      const res = responses[n];
      if (res.interval != 0) {
        roamsrWrite.responseHandler(roamsrWrite.getCurrentCard(), res.interval, res.signal.toString());
      } else {
        await roamsrWrite.responseHandler(roamsrWrite.getCurrentCard(), res.interval, res.signal.toString());
      }
      roamsrWrite.stepToNext();
    }
  }

    // Bindings for 123456789
    if (e.code.includes("Digit")) {
      var n = Math.min(parseInt(e.code.replace("Digit", "")) - 1, responses.length - 1);
      handleNthResponse(n);
      return;
    }

    // Bindings for hjkl
    const letters = ["KeyH", "KeyJ", "KeyK", "KeyL"];
    if (letters.includes(e.code)) {
      var n = Math.min(letters.indexOf(e.code), responses.length - 1);
      handleNthResponse(n);
      return;
    }

    if (e.code == "Space") {
      roamsrWrite.showAnswerAndCloze(false); roamsrWrite.addResponseButtons();
      return;
    }

    if (e.code == "KeyF") {
      roamsrWrite.flagCard().then(() => {
        roamsrWrite.stepToNext();
      });
      return;
    }

    if (e.code == "KeyS" && !e.ctrlKey && !e.shiftKey) {
      roamsrWrite.stepToNext();
      return;
    }

    if (e.code == "KeyD" && e.altKey) {
      roamsrWrite.endSession();
      return;
    }
};

roamsrWrite.processKeyAlways = (e) => {
  // Alt+enter TODO
} 

roamsrWrite.addKeyListener = () => {
    document.addEventListener("keydown", roamsrWrite.processKey);
};

roamsrWrite.removeKeyListener = () => {
    document.removeEventListener("keydown", roamsrWrite.processKey);
};

/* ====== {{sr}} BUTTON ====== */
roamsrWrite.buttonClickHandler = async (e) => {
  if (e.target.tagName === 'BUTTON' && e.target.textContent === roamsrWrite.settings.mainTag) {
    var block = e.target.closest('.roam-block');
    if (block) {
      var uid = block.id.substring(block.id.length - 9);
      const q = `[:find (pull ?page
                    [{:block/children [:block/uid :block/string]}])
                :in $ ?uid
                :where [?page :block/uid ?uid]]`;
      var results = await window.roamAlphaAPI.q(q, uid);
      if (results.length == 0) return;
      var children = results[0][0].children;
      for (child of children) {
        window.roamAlphaAPI.updateBlock({
          block: {
            uid: child.uid,
            string: child.string.trim() + ' #' + roamsrWrite.settings.mainTag
          }
        });
      }
    }
  }
}

document.addEventListener("click", roamsrWrite.buttonClickHandler, false);

/* ====== CALLING FUNCTIONS DIRECTLY ====== */

console.log("🗃️ Loading roam/sr-write " + VERSION + ".");

roamsrWrite.loadSettings();
roamsrWrite.addBasicStyles();
roamsrWrite.loadState(-1).then(res => {
  roamsrWrite.addWidget();
});

console.log("🗃️ Successfully loaded roam/sr-write " + VERSION + ".");
