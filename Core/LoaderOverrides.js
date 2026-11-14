/**
*  @filename    LoaderOverrides.js
*  @author      theBGuy
*  @credit      kolton
*  @desc        script loader, based on mBot's Sequencer.js
*
*/

includeIfNotIncluded("core/Loader.js");

/**
 * Populates fileList with the basenames (no extension) of every .js file in libs/SoloPlay/Scripts.
 */
Loader.getScripts = function () {
  let fileList = dopen("libs/SoloPlay/Scripts").getFiles();

  for (let i = 0; i < fileList.length; i += 1) {
    if (fileList[i].indexOf(".js") > -1) {
      this.fileList.push(fileList[i].substring(0, fileList[i].indexOf(".js")));
    }
  }
};

/**
 * Get script name by index.
 * @param {number} [offset]
 * @returns {string} the script name, or "SoloPlay" when the index is out of range
 */
Loader.scriptName = function (offset = 0) {
  let index = this.scriptIndex + offset;

  if (index >= 0 && index < SoloIndex.scripts.length) {
    return SoloIndex.scripts[index];
  }

  return "SoloPlay";
};

/** @deprecated Loader.run is used instead */
Loader.loadScripts = function () {
  return Loader.run();
};

/** Character level from which a Hell sorceress attempts each progress script ahead of the farming list. */
Loader.progressFirstGates = { travincal: 73, mephisto: 73, diablo: 75, ancients: 77, baal: 78 };

Loader.progressFirstDone = false;

/**
 * @param {{ script: string, failures: number, lastAttemptGame: number, game: number, pending: boolean }} rec
 */
Loader.saveProgressFirst = function (rec) {
  // other writers dump the whole of me.data back into the file
  me.data.progressFirst = rec;
  CharData.updateData("me", { progressFirst: rec });
};

/**
 * Hell sorceress: attempt the next progress script before the farming list. An attempt is stored as pending
 * before it starts, so a game that ends inside the script (death, chicken) counts as a failure in the next game.
 * After two failures in a row, the next two games run only the ordinary list.
 * @returns {string | null} the script that was run, or null
 */
Loader.runProgressFirst = function () {
  const saved = me.data.progressFirst || {};
  const rec = {
    script: saved.script || "",
    failures: saved.failures || 0,
    lastAttemptGame: saved.lastAttemptGame || 0,
    game: (saved.game || 0) + 1,
    pending: false,
  };
  saved.pending && (rec.failures += 1);

  const script = Object.keys(this.progressFirstGates).find(function (name) {
    return !me[name] && !!SoloIndex.index[name] && SoloIndex.index[name].shouldRun();
  });

  if (script && rec.script !== script) {
    rec.script = script;
    rec.failures = 0;
    rec.lastAttemptGame = 0;
  }

  if (!script || me.charlvl < this.progressFirstGates[script]) {
    this.saveProgressFirst(rec);
    return null;
  }

  if (script === "diablo") {
    myPrint("ProgressFirst :: ordinary route diablo");
    this.saveProgressFirst(rec);
    return null;
  }

  if (rec.failures >= 2 && rec.game - rec.lastAttemptGame <= 2) {
    myPrint("ProgressFirst :: backoff " + script);
    this.saveProgressFirst(rec);
    return null;
  }

  rec.lastAttemptGame = rec.game;
  rec.pending = true;
  this.saveProgressFirst(rec);
  myPrint("ProgressFirst :: " + script + " attempt " + (rec.failures + 1));

  const tick = getTickCount();
  Settings.logPerformance && Tracker.scriptStart(script, tick, me.getStat(sdk.stats.Experience));
  this.runScript(script);
  me.maxgametime += (getTickCount() - tick);
  Settings.logPerformance && Tracker.clearInProgress();

  rec.pending = false;
  // The Ancients routine can return after its combat timeout without earning the quest.
  if (script === "ancients" ? me.ancients : this.doneScripts.has(script)) {
    rec.failures = 0;
    myPrint("ProgressFirst :: " + script + " done");
  } else {
    rec.failures += 1;
    myPrint("ProgressFirst :: " + script + " failed");
  }
  this.saveProgressFirst(rec);

  return script;
};

/**
 * Runs each SoloPlay script in SoloIndex.scripts order once its shouldRun() check passes, going to
 * town first unless the script is exempt via skipTown, and tracking performance stats per script.
 * In Hell a sorceress first attempts the next progress script (see runProgressFirst) and runs the
 * optional one-off quests of an act after its required script.
 * @returns {boolean} always true
 */
Loader.run = function () {
  const _toolsThread = "libs/SoloPlay/Threads/ToolsThread.js";
  
  let updatedDifficulty = Check.nextDifficulty();
  if (updatedDifficulty) {
    CharData.updateData("me", "setDifficulty", updatedDifficulty);
    !me.realm && Messaging.sendToScript("D2BotSoloPlay.dbj", "diffChange");
  }

  let progressFirstScript = null;
  if (me.hell && me.sorceress && !Loader.progressFirstDone) {
    Loader.progressFirstDone = true;
    SoloIndex.scripts = SoloIndex.hellScripts();
    progressFirstScript = Loader.runProgressFirst();
  }

  for (Loader.scriptIndex = 0; Loader.scriptIndex < SoloIndex.scripts.length; Loader.scriptIndex++) {
    const ctx = {};
    const script = SoloIndex.scripts[this.scriptIndex];

    if (script === progressFirstScript) continue;
    
    if (!me.inTown && !Loader.skipTown.includes(script)) {
      Town.goToTown();
    }
    
    Check.checkSpecialCase();
    if (!SoloIndex.index[script]) continue;
    if (!SoloIndex.index[script].shouldRun()) continue;

    let j;
    let tick;
    let expStart;
    let failed = false;

    try {
      includeIfNotIncluded("SoloPlay/Scripts/" + script + ".js");

      Loader.currentScript = global[script];

      // Preload the next script
      if (Loader.scriptIndex < Loader.scriptList.length - 1) {
        let nextScript = this.scriptList[Loader.scriptIndex + 1];
        if (include("SoloPlay/Scripts/" + nextScript + ".js")) {
          if (global[nextScript] instanceof Runnable && global[nextScript].startArea) {
            Loader.nextScript = global[nextScript];
          }
        }
      }

      if (Loader.currentScript instanceof Runnable) {
        const { startArea, bossid, preAction, setup } = Loader.currentScript;
            
        if (startArea && Loader.scriptIndex === 0) {
          Loader.firstScriptAct = sdk.areas.actOf(startArea);
        }

        if (bossid && Attack.haveKilled(bossid)) {
          console.log("ÿc2Skipping script: ÿc9" + script + " ÿc2- Boss already killed.");
          continue;
        }

        if (setup && typeof setup === "function") {
          setup(ctx);
        }
            
        if (preAction && typeof preAction === "function") {
          preAction(ctx);
        }

        if (startArea && me.inArea(startArea)) {
          this.skipTown.push(script);
        }
      } else if (typeof (Loader.currentScript) !== "function") {
        throw new Error(
          "Invalid script function name. "
              + "Typeof: " + typeof (Loader.currentScript)
              + " Name: " + script
        );
      }
      
      tick = getTickCount();
      expStart = me.getStat(sdk.stats.Experience);
      Settings.logPerformance && Tracker.scriptStart(script, tick, expStart);
      Messaging.sendToScript(_toolsThread, JSON.stringify({ currScript: script }));
      DataFile.updateStats("lastScript", script);

      for (j = 0; j < 5; j += 1) {
        if (Loader._runCurrent(ctx)) {
          
          if (Loader.currentScript instanceof Runnable) {
            const { postAction } = Loader.currentScript;
              
            if (postAction && typeof postAction === "function") {
              postAction(ctx);
            }
          }
          break;
        }
      }

      (j === 5) && myPrint("script " + script + " failed.");
    } catch (e) {
      console.error(e);
      if (!(e instanceof ScriptError)) {
        failed = true;
      }
    } finally {
      SoloIndex.doneList.push(script);
      // skip logging if we didn't actually finish it
      if (!SoloIndex.retryList.includes(script) && Settings.logPerformance) {
        Tracker.script(tick, script, expStart, !failed);
      }
      Settings.logPerformance && Tracker.clearInProgress();
      console.log("ÿc8Kolbot-SoloPlayÿc0: Old maxgametime: " + Time.format(me.maxgametime));
      me.maxgametime += (getTickCount() - tick);
      console.log("ÿc8Kolbot-SoloPlayÿc0: New maxgametime: " + Time.format(me.maxgametime));
      
      let gain = Math.max(me.getStat(sdk.stats.Experience) - expStart, 0);
      let duration = Time.elapsed(tick);
      console.log(
        "ÿc8Kolbot-SoloPlayÿc0 :: ÿc8" + script
        + "ÿc0 - ÿc7Duration: ÿc0" + Time.format(duration) + "\n"
        + "ÿc7 - Experience Gained: ÿc0" + gain + "\n"
        + "ÿc7 - Exp/minute: ÿc0" + (gain / (duration / 60000)).toFixed(2)
      );

      // remove script function from function scope, so it can be cleared by GC
      if (Loader.scriptIndex < SoloIndex.scripts.length) {
        delete global[script];
        Loader.currentScript = null;
        Loader.nextScript = null;
      }
    }

    if (me.sorceress && me.hell && script === "bloodraven" && me.charlvl < 68) {
      console.info(false, "End-run, we are not ready to keep pushing yet");
        
      break;
    }

    if (me.dead) {
      // not sure how we got here but we are dead, why did toolsthread not quit lets check it
      let tThread = getScript("libs/SoloPlay/Threads/ToolsThread.js");
      if (!tThread || !tThread.running) {
        // well that explains why, toolsthread seems to have crashed lets restart it so we quit properly
        load("libs/SoloPlay/Threads/ToolsThread.js");
      }
    }
  }

  // Re-check to see if after this run we now meet difficulty requirments
  if (!updatedDifficulty) {
    updatedDifficulty = Check.nextDifficulty(false);
    if (updatedDifficulty) {
      CharData.updateData("me", "setDifficulty", updatedDifficulty);
      !me.realm && Messaging.sendToScript("D2BotSoloPlay.dbj", "diffChange");
    }
  }

  return true;
};

/**
 * @param {string} script
 * @param {Partial<Config> | function(): any} configOverride
 * @returns {boolean}
 */
Loader.runScript = function (script, configOverride) {
  let tick;
  let currentExp;
  let failed = false;
  let reconfiguration, unmodifiedConfig = {};
  let mainScript = this.scriptName();
    
  /** @returns {string} log line prefix listing the main script and any nested tempList scripts */
  function buildScriptMsg () {
    let str = "ÿc9" + mainScript + " ÿc0:: ";

    if (Loader.tempList.length && Loader.tempList[0] !== mainScript) {
      Loader.tempList.forEach(s => str += "ÿc9" + s + " ÿc0:: ");
    }
      
    return str;
  }

  this.copy(Config, unmodifiedConfig);

  if (includeIfNotIncluded("SoloPlay/Scripts/" + script + ".js")) {
    const ctx = {
      _parent: Loader.currentScript
    };
    Loader.currentScript = global[script];
    
    try {
      if (Loader.currentScript instanceof Runnable) {
        const { startArea, bossid, preAction, setup } = Loader.currentScript;

        if (startArea && me.inArea(startArea)) {
          Loader.skipTown.push(script);
        }
          
        if (bossid && Attack.haveKilled(bossid)) {
          console.log("ÿc2Skipping script: ÿc9" + script + " ÿc2- Boss already killed.");
          return true;
        }

        if (setup && typeof setup === "function") {
          setup(ctx);
        }
          
        if (preAction && typeof preAction === "function") {
          preAction(ctx);
        }
      } else if (typeof (Loader.currentScript) !== "function") {
        throw new Error("Invalid script function name");
      }

      if (this.skipTown.includes(script) || Town.goToTown()) {
        let mainScriptStr = (mainScript !== script ? buildScriptMsg() : "");
        this.tempList.push(script);
        console.log(mainScriptStr + "ÿc2Starting script: ÿc9" + script);
        Messaging.sendToScript("libs/SoloPlay/Threads/ToolsThread.js", JSON.stringify({ currScript: script }));
        DataFile.updateStats("lastScript", script);

        if (typeof configOverride === "function") {
          reconfiguration = true;
          configOverride();
        }

        tick = getTickCount();
        currentExp = me.getStat(sdk.stats.Experience);

        if (Loader._runCurrent(ctx)) {
          console.log(
            mainScriptStr + "ÿc7" + script
              + " :: ÿc0Complete ÿc0- ÿc7Duration: ÿc0" + (Time.format(getTickCount() - tick))
          );
          let gain = Math.max(me.getStat(sdk.stats.Experience) - currentExp, 0);
          let duration = Time.elapsed(tick);
          console.log(
            mainScriptStr + "ÿc7" + script + " :: ÿc0Complete\n"
              + "ÿc2 Statistics:\n"
              + "ÿc7 - Duration: ÿc0" + (Time.format(duration)) + "\n"
              + "ÿc7 - Experience Gained: ÿc0" + gain + "\n"
              + "ÿc7 - Exp/minute: ÿc0" + (gain / (duration / 60000)).toFixed(2)
          );
          this.doneScripts.add(script);

          if (Loader.currentScript instanceof Runnable) {
            const { postAction } = Loader.currentScript;
              
            if (postAction && typeof postAction === "function") {
              postAction(ctx);
            }
          }
        }
      }
    } catch (e) {
      failed = true;
      console.warn("ÿc8Kolbot-SoloPlayÿc0: " + (e.message ? e.message : e));
    } finally {
      SoloIndex.doneList.push(script);
      Settings.logPerformance && Tracker.script(tick, script, currentExp, !failed);
      // Dont run for last script as that will clear everything anyway
      if (this.scriptIndex < this.scriptList.length) {
        // remove script function from global scope, so it can be cleared by GC
        delete global[script];
      } else if (this.tempList.length) {
        delete global[script];
      }
      // run cleanup if applicable
      if (Loader.currentScript instanceof Runnable) {
        if (Loader.currentScript.cleanup && typeof Loader.currentScript.cleanup === "function") {
          Loader.currentScript.cleanup(ctx);
        }
      }
      Loader.currentScript = ctx._parent;
      Loader.tempList.pop();
        
      if (reconfiguration) {
        console.log("ÿc2Reverting back unmodified config properties.");
        this.copy(unmodifiedConfig, Config);
      }
    }
  } else {
    console.warn("Failed to include: " + script);
  }

  return !failed;
};
