/*
 * Copyright (c) 2019 danamlund
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */


// Fills a div with a minesweeper game and controls to generate fun games.

let MinesweeperMain_maximizers =
    [{ name:"multi blocks",
       description:"more moves that require multiple pieces of information.",
       scorer:function calculateScore(solveScore) {
           return solveScore.permute2 + solveScore.permute3 * 2 + solveScore.permuteAll * 3;
       }
     },
     { name:"2 blocks",
       description:"only moves that require two pieces of information.",
       scorer:function calculateScore(solveScore) {
           return solveScore.permute2;
       },
       doNotCheckMinesLeft:true
     },
     { name:"3 blocks",
       description:"only moves that require three pieces of information.",
       scorer:function calculateScore(solveScore) {
           return solveScore.permute3;
       },
       doNotCheckMinesLeft:true
     },
     { name:">3 blocks",
       description:"only moves that require four or more pieces of information.",
       scorer:function calculateScore(solveScore) {
           return solveScore.permuteAll;
       },
       doNotCheckMinesLeft:true
     },
     { name:"not remaining mines",
       description:`rewards 2-blocks and 3-blocks but
          not &gt;3-blocks. This usually removes the endings requiring
          you to map out 5 remaining mines.`,
       scorer:function calculateScore(solveScore) {
           return solveScore.permute2 + solveScore.permute3 * 2 + solveScore.permuteAll * 3;
       },
       doNotCheckMinesLeft:true
     },
     { name:"steps",
       description:"more iterations of auto-solver needed to solve a game.",
       scorer:function calculateScore(solveScore) {
           return solveScore.steps;
       }
     },
     { name:"high numbers",
       description:"blocks with high numbers have higher scores.",
       scorer:function calculateScore(solveScore) {
           score = 0;
           for (let i = 4; i <= 8; i++) {
               score += solveScore.numbersCounts[i] * solveScore.numbersCounts[i];
           }
           return score;
       }
     },
     { name:"few guesses",
       description:"few number of guesses solver had to make.",
       scorer:function calculateScore(solveScore) {
           return - solveScore.unsolveable;
       },
       guess:true
     },
     // { name:"guessable",
     //   description:"blocks where the calculable mine probability is corrct.",
     //   scorer:function calculateScore(solveScore) {
     //       return solveScore.guessable;
     //   },
     //   guess:true
     // },
    ];

function MinesweeperMain(divElementToPopulate) {
    const MAX_FREES_AMOUNT = 20;

    divElementToPopulate.innerHTML = `
<canvas class="canvas" tabindex="0" width="500" height="500"></canvas>
<table><tr align="right">
<td>width: <input type="text" class="width" value="16" /></td>
<td>mines: <input type="text" class="mines" value="40" /></td>
<td>iterations: <input type="text" class="iterations" value="3" /></td>
<td>board width (px): <input type="text" class="canvaswidth" value="500" /></td>
</tr><tr align="right">
<td>height: <input type="text" class="height" value="16" /></td>
<td>blocks: <input type="text" class="blocks" value="0" /></td>
<td>seed: <input type="text" class="seed" value="" /></td>
<td>board height (px): <input type="text" class="canvasheight" value="500" /></td>
</tr></table>
<div>maximize:
<select class="max"></select>
<input type="checkbox" class="noguessing" checked /> Exclude guessing
</div>
<button class="button">Generate</button>
<input type="checkbox" class="verbose" /> verbose
<input type="checkbox" class="verbose2" /> more verbose
<div class="stopper"></div>
<div class="log"></div>
<div class="verbosediv"></div>
`;

    let minesweeperui = null;
    let generating = false;

    {
        let maxSelect = divElementToPopulate.querySelector(".max");
        for (maximizer of MinesweeperMain_maximizers) {
            maxSelect.innerHTML += "<option>" + maximizer.name + "</option>";
        }
    }

    if (window.location.search.length >= 2) {
        let urlSeed = window.location.search.substring(1);
        let params = urlSeed.split("_");
        divElementToPopulate.querySelector(".width").value = params[0];
        divElementToPopulate.querySelector(".height").value = params[1];
        divElementToPopulate.querySelector(".mines").value = params[2];
        divElementToPopulate.querySelector(".blocks").value = params[3];
        divElementToPopulate.querySelector(".seed").value = params[4];
    }

    function getUrlSeed(mines) {
        return "?"
            + mines.width + "_"
            + mines.height + "_"
            + mines.mines + "_"
            + mines.blocks + "_"
            + mines.seed;
    }

    function show(mines) {
        let log = divElementToPopulate.querySelector(".log");

        log.innerHTML += "Mines size=" + mines.width + "x" + mines.height
            + ", mines=" + mines.mines
            + ", blocks=" + mines.blocks
            + ", seed=" + mines.seed;
        log.innerHTML += " <a href="+getUrlSeed(mines)+">seed url</a>";

        if (minesweeperui) {
            minesweeperui.cleanup();
        }
        let canvas = divElementToPopulate.querySelector(".canvas");
        minesweeperui = new MinesweeperUi(canvas, mines);
    }

    function solveScoreString(solveScore, maximizer, noGuessing) {
        return "1s=" + solveScore.permute1
            + ", 2s=" + solveScore.permute2
            + ", 3s=" + solveScore.permute3
            + ", alls=" + solveScore.permuteAll
            + ", steps=" + solveScore.steps
            + ", unsolveables=" + solveScore.unsolveable
            + ", numbers=" + JSON.stringify(solveScore.numbersCounts)
            + ", maximize=" + maximizer.name
            + ", score=" + calculateScore(solveScore, maximizer, noGuessing);
    }

    function calculateScore(solveScore, maximizer, noGuessing) {
        let score = maximizer.scorer(solveScore);
        if (!maximizer.guess && noGuessing && solveScore.unsolveable >= 1) {
            score = -score - 1;
        }
        return score;
    }

    function generate() {
        if (generating) {
            return;
        }
        generating = true;
        let canvas = divElementToPopulate.querySelector(".canvas");
        let canvasWidth = parseInt(divElementToPopulate.querySelector(".canvaswidth").value);
        let canvasHeight = parseInt(divElementToPopulate.querySelector(".canvasheight").value);
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        let width = parseInt(divElementToPopulate.querySelector(".width").value);
        let height = parseInt(divElementToPopulate.querySelector(".height").value);
        let minesAmount = parseInt(divElementToPopulate.querySelector(".mines").value);
        let blocks = parseInt(divElementToPopulate.querySelector(".blocks").value);
        let iterations = parseInt(divElementToPopulate.querySelector(".iterations").value);
        let seed = divElementToPopulate.querySelector(".seed").value;
        let noGuessing = divElementToPopulate.querySelector(".noguessing").checked;
        let verbose = divElementToPopulate.querySelector(".verbose").checked;
        let verbose2 = divElementToPopulate.querySelector(".verbose2").checked;
        let verbosediv = divElementToPopulate.querySelector(".verbosediv");
        let log = divElementToPopulate.querySelector(".log");
        log.innerHTML = "";
        verbosediv.innerHTML = "";

        let maxSelect = divElementToPopulate.querySelector(".max");
        let maxBy = maxSelect[maxSelect.selectedIndex].text;
        let maximizer = undefined
        for (entry of MinesweeperMain_maximizers) {
            if (entry.name == maxBy) {
                maximizer = entry;
            }
        }

        if (seed) {
            let mines = new Minesweeper( { width: width,
                                           height:height,
                                           mines:minesAmount,
                                           blocks:blocks,
                                           seed:seed } );
            if (verbose) {
                let solveScore = new MinesweeperSolve(mines)
                    .solveScore(MAX_FREES_AMOUNT, maximizer.guess, maximizer.doNotCheckMinesLeft);
                log.innerHTML = "Score: " + solveScoreString(solveScore, maximizer, noGuessing)
                    + "<br/>";
            }
            mines.restart();
            show(mines);
            generating = false;
        } else {

            let bestSolveScore = null;
            let bestScore = -1;
            let bestMines = null;
            let i = 0;
            let stopped = false;
            function doStop() {
                stopped = true;
            }
            let stopperDiv = divElementToPopulate.querySelector(".stopper");
            stopperDiv.innerHTML = "<button class=stopperButton>stop</button>";
            let stopper = stopperDiv.querySelector(".stopperButton");
            stopper.addEventListener("click", doStop);

            let verboseHtml = "";
            if (verbose) {
                verboseHtml = "<table border=1><tr>"
                    + "<td>1s</td><td>2s</td><td>3s</td><td>alls</td><td>steps</td>"
                    + "<td>unsolveables</td><td>numbers counts</td>"
                    + "<td>maximize</td><td>score</td><td>seed url</td></tr>";
            }

            function done(mines) {
                if (verbose) {
                    verboseHtml += "</table>";
                    verbosediv.innerHTML = verboseHtml;
                }
                stopper.removeEventListener("click", doStop);
                stopperDiv.innerHTML = "";
                mines.restart();
                show(mines);
                generating = false;
            }

            function iterate() {
                if (stopped) {
                    done(bestMines);
                    return;
                }

                mines = new Minesweeper( { width: width,
                                                 height:height,
                                                 mines:minesAmount,
                                                 blocks:blocks,
                                                 seed:seed } );
                let solveScore = new MinesweeperSolve(mines)
                    .solveScore(MAX_FREES_AMOUNT, maximizer.guess, maximizer.doNotCheckMinesLeft);
                let score = calculateScore(solveScore, maximizer, noGuessing);
                if (verbose && (verbose2 || score >= 1)) {
                    verboseHtml += "<tr>"
                        + "<td>" + solveScore.permute1 + "</td>"
                        + "<td>" + solveScore.permute2 + "</td>"
                        + "<td>" + solveScore.permute3 + "</td>"
                        + "<td>" + solveScore.permuteAll + "</td>"
                        + "<td>" + solveScore.steps + "</td>"
                        + "<td>" + solveScore.unsolveable + "</td>"
                        + "<td>" + JSON.stringify(solveScore.numbersCounts) + "</td>"
                        + "<td>" + maximizer.name + "</td>"
                        + "<td>" + score + "</td>"
                        + "<td><a href=" + getUrlSeed(mines) + ">seed url</a></td>"
                        + "</tr>";
                }

                if (bestSolveScore == null || score > bestScore) {
                    bestSolveScore = solveScore;
                    bestScore = score;
                    bestMines = mines;
                }
                i++;
                if (verbose) {
                    log.innerHTML = "Best score of " + i + "/" + iterations
                        + " iterations: " + solveScoreString(bestSolveScore, maximizer, noGuessing)
                        + "<br/>";
                } else {
                    log.innerHTML = "Best score of " + i + "/" + iterations
                        + " iterations: " + bestScore + "<br/>";
                }
                if (i < iterations) {
                    setTimeout(iterate, 0);
                } else {
                    done(bestMines);
                }
            }

            setTimeout(iterate, 0);
        }
    }

    let button = divElementToPopulate.querySelector(".button");
    button.addEventListener("click", generate);
    generate();
}
