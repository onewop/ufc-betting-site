import React, { useState, useEffect } from "react";
import axios from "axios";

const LatestOdds = () => {
  const [odds, setOdds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Replace with your free API key from theoddsapi.com
  const ODDS_API_KEY = "5f5bea224d35651f02368c3c0433b1a4";

  const fetchOdds = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h,spreads,totals`
      );
      console.log("API Response:", response.data); // Debugging
      if (response.data.length === 0) {
        setError("No UFC events currently available. Try again later.");
      } else {
        setOdds(response.data);
      }
      setLoading(false);
    } catch (err) {
      console.error("Odds fetch error:", err.response?.data || err);
      setError(
        err.response?.data?.message ||
          "Failed to fetch odds. Check API key or try again later."
      );
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOdds();
  }, []);

  if (loading)
    return (
      <div className="text-center text-gray-300">Loading latest odds...</div>
    );
  if (error) return <div className="text-center text-red-400">{error}</div>;

  return (
    <div className="container mx-auto p-6 min-h-screen">
      <h1 className="text-5xl font-bold mb-8 text-center">Latest Odds</h1>
      <p className="text-gray-300 mb-6 text-center">
        Real-time UFC odds from various bookmakers. Data provided by The Odds
        API.
      </p>
      <div className="flex justify-center mb-8">
        <button onClick={fetchOdds} className="neon-button">
          Refresh Odds
        </button>
      </div>
      {odds.length === 0 ? (
        <div className="text-center text-gray-300">
          No odds available for upcoming UFC events.
        </div>
      ) : (
        odds.map((event, index) => (
          <div key={index} className="card mb-8">
            <h2 className="text-2xl font-semibold mb-4">
              {event.home_team} vs. {event.away_team}
            </h2>
            <table className="w-full text-gray-300">
              <thead>
                <tr>
                  <th>Bookmaker</th>
                  <th>Home Win</th>
                  <th>Away Win</th>
                  <th>Over/Under</th>
                </tr>
              </thead>
              <tbody>
                {event.bookmakers.map((bookmaker, bIndex) => (
                  <tr key={bIndex}>
                    <td>{bookmaker.key}</td>
                    <td>{bookmaker.markets[0]?.outcomes[0]?.price || "N/A"}</td>
                    <td>{bookmaker.markets[0]?.outcomes[1]?.price || "N/A"}</td>
                    <td>
                      {bookmaker.markets[2]?.outcomes[0]?.point || "N/A"} (
                      {bookmaker.markets[2]?.outcomes[0]?.price || "N/A"})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
};

export default LatestOdds;
