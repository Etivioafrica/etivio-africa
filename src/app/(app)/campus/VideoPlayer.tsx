import type { PostVideo } from "./video";

// A video in a post: the site's own player for YouTube, Vimeo and the like, a plain player for video files.
export function VideoPlayer({ video }: { video: PostVideo }) {
  if (video.kind === "file")
    return (
      <div className="et-cps-video is-file">
        <video src={video.src} controls playsInline preload="metadata" />
      </div>
    );
  return (
    <div className={`et-cps-video${video.tall ? " is-tall" : ""}`}>
      <iframe src={video.src} title={`${video.site} video`} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
    </div>
  );
}
