import { safeHttpUrl } from "./urls";

export type VideoEmbed = {
  provider: "youtube" | "vimeo";
  videoId: string;
  /** iframe の src。ユーザーの URL をそのまま使わず、取り出した動画IDから組み立てる（standards/security.md §9.5） */
  src: string;
  /** サムネイル画像（Vimeo は API なしでは取得できないため null） */
  thumbnailUrl: string | null;
};

const YOUTUBE_ID = /^[\w-]{11}$/;

/** YouTube / Vimeo の URL を埋め込み用の情報に変換する。対応外の URL は null（manifests/nodes.md VIDEO ノード） */
export function toVideoEmbed(value: string): VideoEmbed | null {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const host = url.hostname.replace(/^(www\.|m\.)/, "");

  let youtubeId: string | null = null;
  if (host === "youtu.be") youtubeId = url.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    youtubeId =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : (/^\/(?:embed|shorts|live)\/([^/]+)/.exec(url.pathname)?.[1] ?? null);
  }
  if (youtubeId && YOUTUBE_ID.test(youtubeId)) {
    return {
      provider: "youtube",
      videoId: youtubeId,
      src: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const vimeoId = /^\/(?:video\/)?(\d+)/.exec(url.pathname)?.[1];
    if (vimeoId) {
      return {
        provider: "vimeo",
        videoId: vimeoId,
        src: `https://player.vimeo.com/video/${vimeoId}`,
        thumbnailUrl: null,
      };
    }
  }
  return null;
}
