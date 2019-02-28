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

// Fills a div with minesweeper game and controls to generate fun games.
function MinesweeperMain(divElementToPopulate) {

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
<div>Maximize: 
<select class="max">
<option>multi blocks</option>
<option>2 blocks</option>
<option>3 blocks</option>
<option>&gt;3 blocks</option>
<option>not remaining mines</option>
<option>steps</option>
</select>
</div>
<button class="button">Generate</button>
<input type="checkbox" class="verbose" /> verbose
<div class="stopper"></div>
<div class="log"></div>
<div class="verbosediv"></div>
`;

    let minesweeperui = null;
    let generating = false;

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

    function solveScoreString(solveScore) {
        return "1s=" + solveScore.permute1
            + ", 2s=" + solveScore.permute2
            + ", 3s=" + solveScore.permute3
            + ", alls=" + solveScore.permuteAll
            + ", steps=" + solveScore.steps
            + ", unsolveables=" + solveScore.unsolveable
            + ", score=" + solveScore.score;
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
        let verbose = divElementToPopulate.querySelector(".verbose").checked;
        let verbosediv = divElementToPopulate.querySelector(".verbosediv");
        let log = divElementToPopulate.querySelector(".log");

        log.innerHTML = "";
        verbosediv.innerHTML = "";
        if (seed) {
            let mines = new Minesweeper( { width: width,
                                           height:height,
                                           mines:minesAmount,
                                           blocks:blocks,
                                           seed:seed } );
            if (verbose) {
                let solveScore = new MinesweeperSolve(mines).solveScore();
                log.innerHTML = "Score: " + solveScoreString(solveScore) + "<br/>";
            }
            mines.restart();
            show(mines);
            generating = false;
        } else {
            let maxSelect = divElementToPopulate.querySelector(".max");
            let maxBy = maxSelect[maxSelect.selectedIndex].text;
            
            let bestSolveScore = null;
            let bestScore = -1;
            let bestMines = null;
            let i = 0;
            let stopped = false;
            function doStop() {
                console.log("stop!");
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
                    + "<td>unsolveables</td><td>score</td><td>seed url</td></tr>";
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
                let solveScore = new MinesweeperSolve(mines).solveScore();

                if (verbose) {
                    verboseHtml += "<tr>"
                        + "<td>" + solveScore.permute1 + "</td>"
                        + "<td>" + solveScore.permute2 + "</td>"
                        + "<td>" + solveScore.permute3 + "</td>"
                        + "<td>" + solveScore.permuteAll + "</td>"
                        + "<td>" + solveScore.steps + "</td>"
                        + "<td>" + solveScore.unsolveable + "</td>"
                        + "<td>" + solveScore.score + "</td>"
                        + "<td><a href=" + getUrlSeed(mines) + ">seed url</a></td>"
                        + "</tr>";
                }

                let score = -999;
                if (maxBy == "multi blocks") {
                    score = solveScore.score
                } else if (maxBy == "2 blocks") {
                    score = solveScore.permute2;
                } else if (maxBy == "3 blocks") {
                    score = solveScore.permute3;
                } else if (maxBy == ">3 blocks") {
                    score = solveScore.permuteAll;
                } else if (maxBy == "steps") {
                    score = solveScore.steps;
                } else if (maxBy == "not remaining mines") {
                    score = solveScore.permute2 + 2 * solveScore.permute3;
                }
                if (bestSolveScore == null
                    || (solveScore.unsolveable == 0 && score > bestScore)) {
                    bestSolveScore = solveScore;
                    bestScore = score;
                    bestMines = mines;
                }
                i++;
                if (verbose) {
                    log.innerHTML = "Best score of " + i + "/" + iterations
                        + " iterations: " + solveScoreString(bestSolveScore) + "<br/>";
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
