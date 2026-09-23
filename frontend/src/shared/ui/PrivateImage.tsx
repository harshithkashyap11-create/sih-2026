import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { privateMediaUrl } from "../../db/media";
import { useTranslation } from "react-i18next";
export function PrivateImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [resolved, setResolved] = useState<{ source: string; url: string | undefined }>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    if (src) void privateMediaUrl(src).then((url) => {
      objectUrl = url;
      if (!cancelled) setResolved({ source: src, url });
      else if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    }).catch(() => { if (!cancelled && src) setResolved({ source: src, url: undefined }); });
    return () => { cancelled = true; if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl); };
  }, [src, attempt]);
  const url = resolved && resolved.source === src ? resolved.url : undefined;
  return url ? <img {...props} src={url} /> : resolved?.source === src ? <div role="status"><p>{t("memories.photoUnavailable")}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>{t("memories.retryPhoto")}</button></div> : null;
}
