import React, { useState } from "react";
import {
  ExternalLink,
  Headphones,
  ListMusic,
  Play,
  Radio,
  Square,
} from "lucide-react";

const SOURCES = {
  youtube: {
    label: "YouTube radio",
    title: "Lofi Girl · beats to relax / study to",
    url: "https://www.youtube.com/watch?v=X4VbdwhkE10",
    embedUrl:
      "https://www.youtube-nocookie.com/embed/X4VbdwhkE10?autoplay=1&rel=0&modestbranding=1&playsinline=1",
  },
  spotify: {
    label: "Spotify playlist",
    title: "Lofi Girl · Reading lofi",
    url: "https://open.spotify.com/playlist/0wF5xUDywPJxS1OBwFmzxY",
    embedUrl:
      "https://open.spotify.com/embed/playlist/0wF5xUDywPJxS1OBwFmzxY?utm_source=generator&theme=0",
  },
};

function StudyMusicPlayer() {
  const [provider, setProvider] = useState("youtube");
  const [playerOpen, setPlayerOpen] = useState(false);
  const source = SOURCES[provider];

  const changeProvider = (nextProvider) => {
    // Unmount the old iframe first, so two audio sources never overlap.
    setPlayerOpen(false);
    setProvider(nextProvider);
  };

  return (
    <section className="panel study-music-panel" aria-labelledby="study-music-title">
      <div className="music-panel-top">
        <div className="music-heading-copy">
          <span className="section-kicker">
            <Headphones size={14} aria-hidden="true" />
            SET THE STUDY MOOD
          </span>
          <h2 id="study-music-title">Study music</h2>
          <p>Quiet lo-fi in the background. Your focus stays in the foreground.</p>
        </div>
        <span className="music-optional-label">Optional audio</span>
      </div>

      <div className="music-source-switch" role="group" aria-label="Choose music source">
        <button
          type="button"
          className={`music-source-button ${provider === "youtube" ? "is-active" : ""}`}
          aria-pressed={provider === "youtube"}
          onClick={() => changeProvider("youtube")}
        >
          <Radio size={16} aria-hidden="true" />
          YouTube radio
        </button>
        <button
          type="button"
          className={`music-source-button ${provider === "spotify" ? "is-active" : ""}`}
          aria-pressed={provider === "spotify"}
          onClick={() => changeProvider("spotify")}
        >
          <ListMusic size={16} aria-hidden="true" />
          Spotify playlist
        </button>
      </div>

      <div className="music-source-summary">
        <div className="music-record-art" aria-hidden="true">
          {provider === "youtube" ? <Radio size={23} /> : <ListMusic size={23} />}
        </div>
        <div className="music-track-copy">
          <strong>{source.title}</strong>
          <span>
            {provider === "youtube"
              ? "Lofi Girl radio · continuous study beats"
              : "Lofi Girl playlist · calm reading beats"}
          </span>
        </div>
        <a
          className="music-external-link"
          href={source.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${source.label} on its website`}
          title={`Open ${source.label}`}
        >
          <ExternalLink size={17} />
        </a>
      </div>

      {playerOpen ? (
        <div className={`study-music-player-frame ${provider}`}>
          <iframe
            key={provider}
            src={source.embedUrl}
            title={source.title}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="eager"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="music-player-placeholder">
          <div className="music-placeholder-icon">
            {provider === "youtube" ? <Radio size={24} /> : <ListMusic size={24} />}
          </div>
          <div className="music-placeholder-copy">
            <strong>Your focus soundtrack is ready</strong>
            <span>
              Nothing plays until you start it. Use the player controls to pause or adjust volume.
            </span>
          </div>
          <button
            type="button"
            className="music-play-button"
            onClick={() => setPlayerOpen(true)}
          >
            <Play size={16} fill="currentColor" aria-hidden="true" />
            {provider === "youtube" ? "Play music" : "Load playlist"}
          </button>
        </div>
      )}

      {playerOpen && (
        <div className="music-player-footer">
          <span>
            {provider === "youtube"
              ? "Playback starts after your click. Browser or network settings may still block embedded video."
              : "Press Play inside Spotify's player. Spotify may require sign-in for full playback."}
          </span>
          <button
            type="button"
            className="music-stop-button"
            onClick={() => setPlayerOpen(false)}
          >
            <Square size={13} fill="currentColor" aria-hidden="true" />
            Stop music
          </button>
        </div>
      )}
    </section>
  );
}

export default StudyMusicPlayer;
