/* roam/sr - Spaced Repetition in Roam Research
   Author: Adam Krivka
   v1.0.1
   https://github.com/aidam38/roamsrreview
 */

var VERSION = "v1.0.1";

if (!window.roamsrreview) window.roamsrreview = {};

/* ====== SCHEDULERS / ALGORITHMS ====== */

// roamsrreview.ankiScheduler = function(userConfig) { }
roamsrreview.ankiScheduler = (userConfig) => {

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
    responseTexts: ["Again.", "Topical.", "Interesting.", "Rote."]
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
            case "4":
              return [prevFactor + config.factorModifier, (prevInterval + delay) * prevFactor * config.easeBonus];
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
      return [getResponse("1"), getResponse("2"), getResponse("3"), getResponse("4")]
    }
  }
  return algorithm;
};

/* ====== HELPER FUNCTIONS ====== */

roamsrreview.sleep = m => {
  var t = m ? m : 10;
  return new Promise(r => setTimeout(r, t))
};

roamsrreview.createUid = () => {
  // From roam42 based on https://github.com/ai/nanoid#js version 3.1.2
  let nanoid = (t = 21) => { let e = "", r = crypto.getRandomValues(new Uint8Array(t)); for (; t--;) { let n = 63 & r[t]; e += n < 36 ? n.toString(36) : n < 62 ? (n - 26).toString(36).toUpperCase() : n < 63 ? "_" : "-" } return e };
  return nanoid(9);
};

roamsrreview.removeSelector = (selector) => {
  document.querySelectorAll(selector).forEach(element => { element.remove() });
};

roamsrreview.goToUid = (uid) => {
  var baseUrl = "/" + new URL(window.location.href).hash.split("/").slice(0, 3).join("/");
  var url = uid ? baseUrl + "/page/" + uid : baseUrl;
  location.assign(url);
};

roamsrreview.getFuckingDate = (str) => {
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

roamsrreview.getRoamDate = (date) => {
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

roamsrreview.getIntervalHumanReadable = (n) => {
  if (n == 0) return "<10 min"
  else if (n > 0 && n <= 15) return n + " d"
  else if (n <= 30) return (n / 7).toFixed(1) + " w"
  else if (n <= 365) return (n / 30).toFixed(1) + " m"
};

/* ====== LOADING CARDS ====== */

roamsrreview.loadCards = async (limits, dateBasis = new Date()) => {
  // Common functions
  var getDecks = (res) => {
    let recurDeck = (part) => {
      var result = [];
      if (part.refs) result.push(...part.refs)
      if (part._children && part._children.length > 0) result.push(...recurDeck(part._children[0]))
      return result;
    }
    var possibleDecks = recurDeck(res).map(deck => deck.title);
    return possibleDecks.filter(deckTag => roamsrreview.settings.customDecks.map(customDeck => customDeck.tag).includes(deckTag));
  };

  var getAlgorithm = (res) => {
    let decks = getDecks(res);
    let preferredDeck;
    let algorithm;

    if (decks && decks.length > 0) {
      preferredDeck = roamsrreview.settings.customDecks.filter(customDeck => customDeck.tag == decks[decks.length - 1])[0];
    } else preferredDeck = roamsrreview.settings.defaultDeck;

    let scheduler = preferredDeck.scheduler || preferredDeck.algorithm;
    let config = preferredDeck.config;
    if (!scheduler || scheduler === "anki") {
      algorithm = roamsrreview.ankiScheduler(config);
    } else algorithm = scheduler(config);

    return algorithm;
  };

  var isNew = (res) => {
    return res._refs ? !res._refs.some(review => {
      var reviewDate = new Date(roamsrreview.getFuckingDate(review.page.uid));
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
            date: roamsrreview.getFuckingDate(review.page.uid),
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
      [?srPage :node/title "${roamsrreview.settings.mainTag}"] 
      (not-join [?card] 
        [?card :block/refs ?flagPage] 
        [?flagPage :node/title "${roamsrreview.settings.flagTag}"])
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
  var todayUid = roamsrreview.getRoamDate().uid;
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
      [?srPage :node/title "${roamsrreview.settings.mainTag}"]
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
  roamsrreview.state.extraCards = [[], []];
  if (roamsrreview.state.limits) {
    for (deck of roamsrreview.settings.customDecks.concat(roamsrreview.settings.defaultDeck)) {

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
            roamsrreview.state.extraCards[j].push(cards.splice(i, 1));
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

roamsrreview.addBasicStyles = () => {
  var style = `
  .roamsrreview-widget__review-button {
    color: #5C7080 !important;
  }
  
  .roamsrreview-widget__review-button:hover {
    color: #F5F8FA !important;
  }
  
  .roamsrreview-return-button-container {
    z-index: 100000;
    margin: 5px 0px 5px 45px;
  }

  .roamsrreview-wrapper {
    pointer-events: none;
    position: relative;
    bottom: 180px;
    justify-content: center;
  }

  .roamsrreview-container {
    width: 100%;
    max-width: 600px;
    justify-content: center;
    align-items: center;
    padding: 5px 20px;
  }

  .roamsrreview-button {
    z-index: 10000;
    pointer-events: all;
  }

  .roamsrreview-response-area {
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 15px;
  }

  .roamsrreview-flag-button-container {
    width: 100%;
  }
  `
  var basicStyles = Object.assign(document.createElement("style"), {
    id: "roamsrreview-css-basic",
    innerHTML: style
  });
  document.getElementsByTagName("head")[0].appendChild(basicStyles);
};

roamsrreview.setCustomStyle = (yes) => {
  var styleId = "roamsrreview-css-custom"
  var element = document.getElementById(styleId);
  if (element) element.remove();

  if (yes) {
    // Query new style
    var styleQuery = window.roamAlphaAPI.q(
      `[:find (pull ?style [:block/string]) :where [?roamsrreview :node/title "roam\/sr"] [?roamsrreview :block/children ?css] [?css :block/refs ?roamcss] [?roamcss :node/title "roam\/css"] [?css :block/children ?style]]`
    );

    if (styleQuery && styleQuery.length != 0) {
      var customStyle = styleQuery[0][0].string.replace("`"+"``css", "").replace("`"+"``", "");

      var roamsrreviewCSS = Object.assign(document.createElement("style"), {
        id: styleId,
        innerHTML: customStyle
      });

      document.getElementsByTagName("head")[0].appendChild(roamsrreviewCSS);
    }
  }
};

roamsrreview.showAnswerAndCloze = (yes) => {
  var styleId = "roamsrreview-css-mainview"
  var element = document.getElementById(styleId);
  if (element) element.remove();

  if (yes) {
    var clozeStyle = roamsrreview.settings.clozeStyle || "highlight";
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

roamsrreview.scheduleCardIn = async (card, interval) => {
  var nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  var nextRoamDate = roamsrreview.getRoamDate(nextDate);

  // Create daily note if it doesn't exist yet
  await window.roamAlphaAPI.createPage({
    page: {
      title: nextRoamDate.title
    }
  });

  await roamsrreview.sleep();

  // Query for the [[roam/sr/review]] block
  var queryReviewBlock = window.roamAlphaAPI.q('[:find (pull ?reviewBlock [:block/uid]) :in $ ?dailyNoteUID :where [?reviewBlock :block/refs ?reviewPage] [?reviewPage :node/title "roam/sr/review"] [?dailyNote :block/children ?reviewBlock] [?dailyNote :block/uid ?dailyNoteUID]]', nextRoamDate.uid);

  // Check if it's there; if not, create it
  var topLevelUid;
  if (queryReviewBlock.length == 0) {
    topLevelUid = roamsrreview.createUid();
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
    await roamsrreview.sleep();
  } else {
    topLevelUid = queryReviewBlock[0][0].uid;
  }

  // Generate the block
  var block = {
    uid: roamsrreview.createUid(),
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
  await roamsrreview.sleep();

  return {
    date: nextRoamDate.uid,
    signal: null,
    uid: block.uid,
    string: block.string
  };
};

roamsrreview.responseHandler = async (card, interval, signal) => {
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
    var todayReviewBlock = await roamsrreview.scheduleCardIn(card, 0);
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
  var nextReview = await roamsrreview.scheduleCardIn(card, interval);
  hist.push(nextReview);

  // If it's scheduled for today, add it to the end of the queue
  if (interval == 0) {
    var newCard = card;
    newCard.history = hist;
    newCard.isNew = false;
    roamsrreview.state.queue.push(newCard);
  }
};

roamsrreview.flagCard = () => {
  var card = roamsrreview.getCurrentCard();
  window.roamAlphaAPI.updateBlock({
    block: {
      uid: card.uid,
      string: card.string + " #" + roamsrreview.settings.flagTag
    }
  });
  
  var j = roamsrreview.getCurrentCard().isNew ? 0 : 1;

  var extraCard = roamsrreview.state.extraCards[j].shift();
  if(extraCard) roamsrreview.state.queue.push(extraCard);
};

roamsrreview.stepToNext = async () => {
  if (roamsrreview.state.currentIndex + 1 >= roamsrreview.state.queue.length) {
    roamsrreview.endSession();
  } else {
    roamsrreview.state.currentIndex++;
    roamsrreview.goToCurrentCard();
  }
  roamsrreview.updateCounters();
};

roamsrreview.goToCurrentCard = async () => {
  window.onhashchange = () => { };
  roamsrreview.showAnswerAndCloze(true);
  roamsrreview.removeReturnButton();
  var doStuff = async () => {
    roamsrreview.goToUid(roamsrreview.getCurrentCard().uid);
    await roamsrreview.sleep(50);
    roamsrreview.addContainer();
    roamsrreview.addShowAnswerButton();
  }

  await doStuff();
  window.onhashchange = doStuff;

  await roamsrreview.sleep(500);

  await doStuff();

  window.onhashchange = () => {
    roamsrreview.removeContainer();
    roamsrreview.addReturnButton();
    roamsrreview.showAnswerAndCloze(false);
    window.onhashchange = () => { };
  }
};

/* ====== SESSIONS ====== */

roamsrreview.loadSettings = () => {
  // Default settings
  roamsrreview.settings = {
    mainTag: "sr-review",
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
  roamsrreview.settings = Object.assign(roamsrreview.settings, window.roamsrreviewUserSettings);
};

roamsrreview.loadState = async (i) => {
  roamsrreview.state = {
    limits: true,
    currentIndex: i,
  }
  roamsrreview.state.queue = await roamsrreview.loadCards();
  return;
};

roamsrreview.getCurrentCard = () => {
  var card = roamsrreview.state.queue[roamsrreview.state.currentIndex];
  return card ? card : {};
};

roamsrreview.startSession = async () => {
  if (roamsrreview.state && roamsrreview.state.queue.length > 0) {
    console.log("Starting session.");

    roamsrreview.setCustomStyle(true);

    // Hide left sidebar
    try {
      document.getElementsByClassName("bp3-icon-menu-closed")[0].click();
    } catch (e) { }

    roamsrreview.loadSettings();
    await roamsrreview.loadState(0);

    console.log("The queue: ");
    console.log(roamsrreview.state.queue);

    await roamsrreview.goToCurrentCard();

    roamsrreview.addKeyListener();

    // Change widget
    var widget = document.querySelector(".roamsrreview-widget")
    widget.innerHTML = "<div style='padding: 5px 0px'><span class='bp3-icon bp3-icon-cross'></span> END SESSION</div>";
    widget.onclick = roamsrreview.endSession;
  }
};

roamsrreview.endSession = async () => {
  window.onhashchange = () => { };
  console.log("Ending sesion.");

  // Change widget
  roamsrreview.removeSelector(".roamsrreview-widget");
  roamsrreview.addWidget();

  // Remove elements
  var doStuff = async () => {
    roamsrreview.removeContainer();
    roamsrreview.removeReturnButton();
    roamsrreview.setCustomStyle(false);
    roamsrreview.showAnswerAndCloze(false);
    roamsrreview.removeKeyListener();
    roamsrreview.goToUid();

    await roamsrreview.loadState(-1);
    roamsrreview.updateCounters();
  }

  await doStuff();
  await roamsrreview.sleep(200);
  await doStuff(); // ... again to make sure
  await roamsrreview.sleep(1000);
  await roamsrreview.loadState(-1);
  roamsrreview.updateCounters(); // ... once again
};

/* ====== UI ELEMENTS ====== */

// COMMON
roamsrreview.getCounter = (deck) => {
  // Getting the number of new cards
  var cardCount = [0, 0];
  if (roamsrreview.state.queue) {
    var remainingQueue = roamsrreview.state.queue.slice(Math.max(roamsrreview.state.currentIndex, 0));
    var filteredQueue = !deck ? remainingQueue : remainingQueue.filter((card) => card.decks.includes(deck));
    cardCount = filteredQueue.reduce((a, card) => {
      if (card.isNew) a[0]++;
      else a[1]++;
      return a;
    }, [0, 0]);
  }

  // Create the element
  var counter = Object.assign(document.createElement("div"), {
    className: "roamsrreview-counter",
    innerHTML: `<span style="color: dodgerblue; padding-right: 8px">` + cardCount[0] + `</span> <span style="color: green;">` + cardCount[1] + `</span>`,
  });
  return counter;
};

roamsrreview.updateCounters = () => {
  var counter = document.querySelectorAll(".roamsrreview-counter").forEach(counter => {
    counter.innerHTML = roamsrreview.getCounter().innerHTML;
    counter.style.cssText = !roamsrreview.state.limits ? "font-style: italic;" : "font-style: inherit;"
  })
};

// CONTAINER
roamsrreview.addContainer = () => {
  if (!document.querySelector(".roamsrreview-container")) {
    var wrapper = Object.assign(document.createElement("div"), {
      className: "flex-h-box roamsrreview-wrapper"
    })
    var container = Object.assign(document.createElement("div"), {
      className: "flex-v-box roamsrreview-container",
    });

    var flagButtonContainer = Object.assign(document.createElement("div"), {
      className: "flex-h-box roamsrreview-flag-button-container"
    });
    var flagButton = Object.assign(document.createElement("button"), {
      className: "bp3-button roamsrreview-button",
      innerHTML: "Flag.",
      onclick: async () => {
        await roamsrreview.flagCard();
        roamsrreview.stepToNext();
      }
    });
    var skipButton = Object.assign(document.createElement("button"), {
      className: "bp3-button roamsrreview-button",
      innerHTML: "Skip.",
      onclick: roamsrreview.stepToNext
    });
    flagButtonContainer.style.cssText = "justify-content: space-between;";
    flagButtonContainer.append(flagButton, skipButton);

    var responseArea = Object.assign(document.createElement("div"), {
      className: "flex-h-box roamsrreview-container__response-area"
    });

    container.append(roamsrreview.getCounter(), responseArea, flagButtonContainer);
    wrapper.append(container);

    var bodyDiv = document.querySelector(".roam-body-main");
    bodyDiv.append(wrapper);
  }
};

roamsrreview.removeContainer = () => {
  roamsrreview.removeSelector(".roamsrreview-wrapper");
};

roamsrreview.clearAndGetResponseArea = () => {
  var responseArea = document.querySelector(".roamsrreview-container__response-area");
  if (responseArea) responseArea.innerHTML = ""
  return responseArea;
};

roamsrreview.addShowAnswerButton = () => {
  var responseArea = roamsrreview.clearAndGetResponseArea();

  var showAnswerAndClozeButton = Object.assign(document.createElement("button"), {
    className: "bp3-button roamsrreview-container__response-area__show-answer-button roamsrreview-button",
    innerHTML: "Show answer.",
    onclick: () => { roamsrreview.showAnswerAndCloze(false); roamsrreview.addResponseButtons(); }
  })
  showAnswerAndClozeButton.style.cssText = "margin: 5px;";

  responseArea.append(showAnswerAndClozeButton);
};

roamsrreview.addResponseButtons = () => {
  var responseArea = roamsrreview.clearAndGetResponseArea();

  // Add new responses
  var responses = roamsrreview.getCurrentCard().algorithm(roamsrreview.getCurrentCard().history);
  for (response of responses) {
    const res = response;
    var responseButton = Object.assign(document.createElement("button"), {
      id: "roamsrreview-response-" + res.signal,
      className: "bp3-button roamsrreview-container__response-area__response-button roamsrreview-button",
      innerHTML: res.responseText + "<sup>" + roamsrreview.getIntervalHumanReadable(res.interval) + "</sup>",
      onclick: async () => {
        if (res.interval != 0) {
          roamsrreview.responseHandler(roamsrreview.getCurrentCard(), res.interval, res.signal.toString());
        } else {
          await roamsrreview.responseHandler(roamsrreview.getCurrentCard(), res.interval, res.signal.toString());
        }
        roamsrreview.stepToNext();
      }
    })
    responseButton.style.cssText = "margin: 5px;";
    responseArea.append(responseButton);
  }
};

// RETURN BUTTON
roamsrreview.addReturnButton = () => {
  var returnButtonClass = "roamsrreview-return-button-container";
  if (document.querySelector(returnButtonClass)) return;

  var main = document.querySelector(".roam-main");
  var body = document.querySelector(".roam-body-main");
  var returnButtonContainer = Object.assign(document.createElement("div"), {
    className: "flex-h-box " + returnButtonClass,
  });
  var returnButton = Object.assign(document.createElement("button"), {
    className: "bp3-button bp3-large roamsrreview-return-button",
    innerText: "Return.",
    onclick: roamsrreview.goToCurrentCard
  });
  returnButtonContainer.append(returnButton);
  main.insertBefore(returnButtonContainer, body);
};

roamsrreview.removeReturnButton = () => {
  roamsrreview.removeSelector(".roamsrreview-return-button-container");
};

// SIDEBAR WIDGET
roamsrreview.createWidget = () => {
  var widget = Object.assign(document.createElement("div"), {
    className: "log-button flex-h-box roamsrreview-widget",
  });
  widget.style.cssText = "align-items: center; justify-content: space-around; padding-top: 8px;"

  var reviewButton = Object.assign(document.createElement("div"), {
    className: "bp3-button bp3-minimal roamsrreview-widget__review-button",
    innerHTML: `<span style="padding-right: 8px;"><svg width="16" height="16" version="1.1" viewBox="0 0 4.2333 4.2333" style="color:5c7080;">
  <g id="chat_1_" transform="matrix(.26458 0 0 .26458 115.06 79.526)">
    <g transform="matrix(-.79341 0 0 -.88644 -420.51 -284.7)" fill="currentColor">
      <path d="m6 13.665c-1.1 0-2-1.2299-2-2.7331v-6.8327h-3c-0.55 0-1 0.61495-1 1.3665v10.932c0 0.7516 0.45 1.3665 1 1.3665h9c0.55 0 1-0.61495 1-1.3665l-5.04e-4 -1.5989v-1.1342h-0.8295zm9-13.665h-9c-0.55 0-1 0.61495-1 1.3665v9.5658c0 0.7516 0.45 1.3665 1 1.3665h9c0.55 0 1-0.61495 1-1.3665v-9.5658c0-0.7516-0.45-1.3665-1-1.3665z"
        clip-rule="evenodd" fill="currentColor" fill-rule="evenodd" />
    </g>
  </g></svg></span> SR REVIEW`,
    //  <span class="bp3-icon bp3-icon-chevron-down expand-icon"></span>`
    onclick: roamsrreview.startSession
  });
  reviewButton.style.cssText = "padding: 2px 8px;";

  var counter = Object.assign(roamsrreview.getCounter(), {
    className: "bp3-button bp3-minimal roamsrreview-counter",
    onclick: async () => {
      roamsrreview.state.limits = !roamsrreview.state.limits;
      roamsrreview.state.queue = await roamsrreview.loadCards();
      roamsrreview.updateCounters();
    }
  });
  var counterContainer = Object.assign(document.createElement("div"), {
    className: "flex-h-box roamsrreview-widget__counter",
  })
  counterContainer.style.cssText = "justify-content: center; width: 50%";
  counterContainer.append(counter);

  widget.append(reviewButton, counterContainer);

  return widget;
};

roamsrreview.addWidget = () => {
  if (!document.querySelector(".roamsrreview-widget")) {
    roamsrreview.removeSelector(".roamsrreview-widget-delimiter")
    var delimiter = Object.assign(document.createElement("div"), {
      className: "roamsrreview-widget-delimiter"
    });
    delimiter.style.cssText = "flex: 0 0 1px; background-color: rgb(57, 75, 89); margin: 8px 20px;";

    var widget = roamsrreview.createWidget();

    var sidebar = document.querySelector(".roam-sidebar-content");
    var starredPages = document.querySelector(".starred-pages-wrapper");

    sidebar.insertBefore(delimiter, starredPages);
    sidebar.insertBefore(widget, starredPages);
  }
};

/* ====== KEYBINDINGS ====== */
roamsrreview.processKey = (e) => {
  // console.log("alt: " + e.altKey + "  shift: " + e.shiftKey + "  ctrl: " + e.ctrlKey + "   code: " + e.code + "   key: " + e.key);
  if (document.activeElement.type == "textarea" || !location.href.includes(roamsrreview.getCurrentCard().uid)) {
    return;
  }

  var responses = roamsrreview.getCurrentCard().algorithm(roamsrreview.getCurrentCard().history);
  var handleNthResponse = async (n) => {
    console.log("Handling response: " + n)
    if (n >= 0 && n < responses.length) {
      const res = responses[n];
      if (res.interval != 0) {
        roamsrreview.responseHandler(roamsrreview.getCurrentCard(), res.interval, res.signal.toString());
      } else {
        await roamsrreview.responseHandler(roamsrreview.getCurrentCard(), res.interval, res.signal.toString());
      }
      roamsrreview.stepToNext();
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
      roamsrreview.showAnswerAndCloze(false); roamsrreview.addResponseButtons();
      return;
    }

    if (e.code == "KeyF") {
      roamsrreview.flagCard().then(() => {
        roamsrreview.stepToNext();
      });
      return;
    }

    if (e.code == "KeyS" && !e.ctrlKey && !e.shiftKey) {
      roamsrreview.stepToNext();
      return;
    }

    if (e.code == "KeyD" && e.altKey) {
      roamsrreview.endSession();
      return;
    }
};

roamsrreview.processKeyAlways = (e) => {
  // Alt+enter TODO
} 

roamsrreview.addKeyListener = () => {
    document.addEventListener("keydown", roamsrreview.processKey);
};

roamsrreview.removeKeyListener = () => {
    document.removeEventListener("keydown", roamsrreview.processKey);
};

/* ====== {{sr}} BUTTON ====== */
roamsrreview.buttonClickHandler = async (e) => {
  if (e.target.tagName === 'BUTTON' && e.target.textContent === roamsrreview.settings.mainTag) {
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
            string: child.string.trim() + ' #' + roamsrreview.settings.mainTag
          }
        });
      }
    }
  }
}

document.addEventListener("click", roamsrreview.buttonClickHandler, false);

/* ====== CALLING FUNCTIONS DIRECTLY ====== */

console.log("🗃️ Loading roam/sr " + VERSION + ".");

roamsrreview.loadSettings();
roamsrreview.addBasicStyles();
roamsrreview.loadState(-1).then(res => {
  roamsrreview.addWidget();
});

console.log("🗃️ Successfully loaded roam/sr " + VERSION + ".");
