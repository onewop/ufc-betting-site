--- 
+++ 
@@ -344,6 +344,12 @@
                      <span className="text-stone-400">
                        ${lineup.salary.toLocaleString()} · {lineup.projMid} pts
                      </span>
                    </li>
+                   </ul>
+                   <div className="flex justify-between text-xs text-stone-400 border-t border-stone-700 pt-2">
+                     <span>
+                       Total Salary: <span className="text-stone-100 font-bold">${lineup.totalSalary.toLocaleString()}</span>
+                     </span>
+                     <span>
+                       Proj Pts: <span className="text-yellow-400 font-bold">{lineup.totalPoints}</span>
+                     </span>
+                   </div>
                  </div>
                </div>
              </div>
@@ -365,6 +371,12 @@
              <div className="flex gap-3 justify-center mb-6 flex-wrap">
                <button onClick={() => runOptimizer(1)} className="neon-button">
                  Build Optimal Lineup
                </button>
                <button
                  onClick={() => runOptimizer(5)}
                  className="neon-button bg-gray-700 hover:bg-gray-600"
                >
                  Build 5 Diverse Lineups
                </button>
                <button
                  onClick={downloadOptimalCSV}
                  className="neon-button bg-green-900 hover:bg-green-800"
                >
                  Download CSV
                </button>
+               <button
+                 onClick={() => alert("Quick test successful - deepseek 16b")}
+                 className="neon-button bg-blue-900 hover:bg-blue-800"
+               >
+                 Run Quick Test
+               </button>
              </div>
              {optimizerError && (
                <p className="text-red-400 text-center text-sm mb-4">
