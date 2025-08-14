import React from "react";

const videos = [
  {
    title: "Bambi Meets Godzilla (1969 Animation)",
    url: "https://www.youtube.com/watch?v=5R-rbzcEM8A",
  },
  {
    title: "Godzilla vs Bambi (Fan Animation)",
    url: "https://www.youtube.com/watch?v=b8zOPlGjJU0",
  },
  {
    title: "1 Man vs 2 Women MMA (RXF Romania Match)",
    url: "https://www.youtube.com/watch?v=LzTuulD6g",
  },
  {
    title: "Female MMA Fighter vs Fat Man (Epic Mismatch)",
    url: "https://www.youtube.com/watch?v=ojBjiFaG5Iw",
  },
  {
    title: "2 Women vs 1 Man Pillow Fight-Style (Bulgarian Weird Fight)",
    url: "https://www.youtube.com/watch?v=IoeuV4Y8kGs",
  },
  {
    title: "Weird Bulgarian Ultras Street Fight",
    url: "https://www.youtube.com/watch?v=lWSQz_t_tWWvA",
  },
  {
    title: "20 Weirdest MMA Moments Compilation",
    url: "https://www.youtube.com/watch?v=ZTGtUrI-t1k",
  },
  {
    title: "Strange and Funny Fights Playlist",
    url: "https://www.youtube.com/playlist?list=PLGqkiMCyZ_6kVBV-ISO8-DctlwcKQY--z",
  },
  {
    title: "Ridiculous MMA Fight Endings",
    url: "https://www.youtube.com/watch?v=QnKIhrtvM3A",
  },
  {
    title: "Hilarious Fight Opening Moments",
    url: "https://www.youtube.com/watch?v=k_1wZ_t_tWWvA",
  },
  {
    title: "Craziest Women's MMA Fights Marathon",
    url: "https://www.youtube.com/watch?v=Wn4uZdJK3woE",
  },
];

const VideoVault = () => {
  return (
    <div className="container mx-auto p-6 min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      <h1 className="text-5xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500">
        Video Vault
      </h1>
      <p className="text-gray-300 mb-6 text-center">
        Explore unusual, funny, and weird fights for entertainment purposes.
        Viewer discretion advised.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video, index) => (
          <div
            key={index}
            className="card pearl-border shadow-neon transform hover:scale-105 transition duration-300"
          >
            <h2 className="text-2xl font-semibold mb-4 text-center">
              {video.title}
            </h2>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="neon-button w-full text-center"
            >
              Watch Video
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoVault;
