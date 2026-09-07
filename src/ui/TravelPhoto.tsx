import { translateDisplay as display } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TravelPhoto as Photo } from '../data/photos';

export default function TravelPhoto({ photo, className = '', compact = false, priority = false, mystery = false }: {
  photo?: Photo; className?: string; compact?: boolean; priority?: boolean; mystery?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  if (!photo) return null;
  return <>
    <figure className={`travel-photo ${className}`}>
      <button className="photo-open" onClick={() => setOpen(true)} aria-label={display(mystery ? '단서 사진 확대' : `${photo.title} 사진 확대`)}>
        {display(!failed ? <img src={compact ? photo.thumb : photo.src} alt={display(mystery ? '장소를 추리할 여행 사진. 아래 메모를 읽고 골라보세요.' : photo.title)} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} width={photo.width} height={photo.height} onError={() => setFailed(true)} />
          : <span className="photo-error">{display("사진을 불러오지 못했어요. 눌러서 다시 보기")}</span>)}
        <span className="photo-zoom" aria-hidden="true">⤢</span>
      </button>
      {display(!compact && !mystery && <figcaption>{display(photo.title)}<span>{display("사진 · ")}{display(photo.author)}</span></figcaption>)}
    </figure>
    {display(open && createPortal(<dialog ref={dialog} className="photo-dialog" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <button className="close-photo" autoFocus onClick={() => dialog.current?.close()} aria-label={display("사진 닫기")}>×</button>
      <img src={photo.src} alt={display(mystery ? '확대한 단서 사진' : photo.title)} />
      <div className="photo-credit"><b>{display(mystery ? '여행 사진 · 장소를 맞혀보세요' : photo.title)}</b><span>{display(photo.author)} · <a href={photo.sourceUrl} target="_blank" rel="noreferrer">{display("Wikimedia Commons 원본")}</a> · <a href={photo.licenseUrl || photo.sourceUrl} target="_blank" rel="noreferrer">{display(photo.license)}</a></span><small>{display("크기 조정 · WebP 변환. 게임 화면에서는 일부가 잘려 보일 수 있습니다.")}</small></div>
    </dialog>, document.body))}
  </>;
}
