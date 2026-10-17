import { useEffect, useRef, useState } from 'react';
import { RoundResult } from './RoundResult';
import { gameAudio } from '@/lib/gameAudio';
import type { PairedConnection, PairedState } from '@/transport/PairedConnection';

const controlFor = (key: string) => ({ ArrowLeft: 1, a: 1, A: 1, ArrowRight: 2, d: 2, D: 2, ArrowUp: 3, w: 3, W: 3 })[key];
const interactive = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('button,input,select,textarea,a,[contenteditable="true"]'));
const button = 'rounded-lg border border-neutral-600 px-4 py-2 hover:bg-neutral-800';
type Frame = NonNullable<ReturnType<PairedConnection['frame']>>;

export function RaceView({ connection, state, onLeave, suspended }: { connection: PairedConnection; state: PairedState; suspended: boolean; onLeave: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pressed = useRef(new Set<string>());
  const [muted, setMuted] = useState(!gameAudio.enabled);
  const [menu, setMenu] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [frame, setFrame] = useState<Frame>();
  const local = state.identity?.seat ?? 0;
  const context = state.context!;
  useEffect(() => { canvas.current?.focus(); return () => connection.releaseControls(); }, [connection]);
  useEffect(() => {
    const release = () => { pressed.current.clear(); connection.releaseControls(); };
    const down = (event: KeyboardEvent) => {
      if (event.repeat || pressed.current.has(event.code)) return;
      pressed.current.add(event.code);
      if (suspended || state.outcome) return;
      if (event.key === 'Escape' && (menu || !interactive(event.target)) || (event.code === 'Space' && !interactive(event.target))) {
        event.preventDefault(); connection.releaseControls(); setMenu(value => !value); return;
      }
      const control = controlFor(event.key);
      if (control && !menu && event.target === canvas.current && document.hasFocus() && !document.hidden) { event.preventDefault(); connection.input(0, control); }
    };
    const up = (event: KeyboardEvent) => {
      pressed.current.delete(event.code);
      if (suspended) return;
      const control = controlFor(event.key);
      if (control && !interactive(event.target)) { connection.input(1, control); if (event.target === canvas.current) event.preventDefault(); }
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', release); document.addEventListener('visibilitychange', release);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', release); };
  }, [connection, menu, suspended, state.outcome]);
  useEffect(() => {
    connection.releaseControls();
    if (!menu && !suspended && !state.outcome && state.status === 'Connected') canvas.current?.focus();
  }, [connection, menu, suspended, state.outcome, state.status]);
  useEffect(() => {
    let handle = 0, lastHud = 0;
    const draw = (time: number) => {
      const view = connection.frame();
      const element = canvas.current, ctx = element?.getContext('2d');
      if (view && ctx && element) {
        const width = element.width, height = element.height;
        const g = context.gameplay, scale = width / (g.laneSpacing * 3.5);
        const camera = view.renderedCars[local].progress;
        const y = (progress: number) => height * .76 - (progress - camera) * scale;
        ctx.fillStyle = '#171b24'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#272d38'; ctx.fillRect(width / 2 - g.laneSpacing * 1.5 * scale, 0, g.laneSpacing * 3 * scale, height);
        ctx.strokeStyle = '#737c90'; ctx.lineWidth = 2; ctx.setLineDash([20, 24]);
        for (const lane of [-.5, .5]) { ctx.beginPath(); ctx.moveTo(width / 2 + lane * g.laneSpacing * scale, 0); ctx.lineTo(width / 2 + lane * g.laneSpacing * scale, height); ctx.stroke(); }
        ctx.setLineDash([]);
        ctx.textAlign = 'left';
        const finishY = y(g.finishDistance);
        if (finishY > -30 && finishY < height + 30) { ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, finishY - 6, width, 12); ctx.font = '18px sans-serif'; ctx.fillText('FINISH', 12, finishY - 18); }
        for (const object of view.objects) {
          const kind = object.flags & 3;
          if (object.flags & (kind === 2 ? 8 << local : 4)) continue;
          const x = width / 2 + (object.lane - 1) * g.laneSpacing * scale, cy = y(object.distance);
          const ow = (kind === 2 ? g.obstacleW : kind === 1 ? g.coinSize : g.heartSize) * scale;
          const oh = (kind === 2 ? g.obstacleH : kind === 1 ? g.coinSize : g.heartSize) * scale;
          if (cy < -oh || cy > height + oh) continue;
          ctx.fillStyle = kind === 2 ? '#f59e0b' : kind === 3 ? '#fb7185' : '#fde047';
          if (kind === 2) { ctx.fillRect(x - ow / 2, cy - oh / 2, ow, oh); ctx.fillStyle = '#171b24'; ctx.fillRect(x - ow / 2, cy - oh / 8, ow, oh / 4); }
          else { ctx.font = `${ow}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(kind === 3 ? '♥' : '●', x, cy + oh / 3); }
        }
        if (view.feedback.length) setFeedback(view.feedback.join(' · '));
        view.renderedCars.forEach((car, seat) => {
          const x = width / 2 + car.lateral * scale, cy = y(car.progress);
          ctx.fillStyle = seat === local ? '#e74656' : '#40c9d5';
          ctx.fillRect(x - g.carWidth * scale / 2, cy - g.carHeight * scale / 2, g.carWidth * scale, g.carHeight * scale);
          ctx.fillStyle = '#111827'; ctx.fillRect(x - g.carWidth * scale * .34, cy - g.carHeight * scale * .28, g.carWidth * scale * .68, g.carHeight * scale * .2);
          ctx.fillStyle = 'white'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(seat === local ? 'You' : 'Rival', x, cy + g.carHeight * scale / 2 + 20);
        });
        connection.recordDraw();
        if (time - lastHud > 40) { lastHud = time; setFrame(view); }
      }
      handle = requestAnimationFrame(draw);
    };
    handle = requestAnimationFrame(draw); return () => cancelAnimationFrame(handle);
  }, [connection, context, local]);
  const outcome = state.outcome ?? frame?.outcome;
  useEffect(() => { if (outcome) connection.recordResultCommit(); }, [connection, outcome]);
  return <div className="relative flex flex-col gap-3">
    <div className="grid grid-cols-2 gap-3">{state.room?.seats.map((seat, i) => <div key={i} className="rounded border border-neutral-700 p-3">
      <p>{seat.name}{i === local ? ' (You)' : ''}</p><p data-testid={`hp-${i}`}>HP {frame?.cars[i].hp ?? context.gameplay.maxHealth}</p><p>Score {frame?.cars[i].score ?? 0}</p>
      <progress className="w-full" aria-label={`${i === local ? 'Your' : 'Opponent'} finish progress`} value={frame?.cars[i].progress ?? 0} max={context.gameplay.finishDistance - context.gameplay.carHeight / 2} />
      <p>{Math.round((frame?.cars[i].progress ?? 0) / (context.gameplay.finishDistance - context.gameplay.carHeight / 2) * 100)}%</p>
    </div>)}</div>
    <p role="status" data-testid="object-feedback">{feedback}</p>
    <p data-testid="nos-status">{frame?.cars[local].effective === 3 ? 'NOS active' : 'NOS ready'}</p>
    {frame?.awaiting && !outcome && <p role="status">Awaiting confirmation</p>}
    {!((state.room?.seats[1 - local]?.flags ?? 0) & 1) && !outcome && <p role="status">Opponent disconnected—round continues.</p>}
    {(frame?.stale || state.status !== 'Connected') && !outcome && <p role="alert">Reconnecting—round continues.</p>}
    <canvas ref={canvas} width={560} height={440} tabIndex={0} role="img" aria-label="Multiplayer race" className="w-full rounded-xl border border-neutral-600 focus:outline-2 focus:outline-red-400" onBlur={() => { pressed.current.clear(); connection.releaseControls(); }} />
    <p className="text-sm text-neutral-400">← / A and → / D steer · ↑ / W holds NOS · Space / Escape opens menu</p>
    <button className={button} onClick={() => { connection.releaseControls(); setMenu(true); }}>Race menu</button>
    {menu && !outcome && <div role="dialog" aria-label="Race menu" className="absolute inset-x-4 top-1/3 bg-neutral-950/95 border border-neutral-600 rounded-xl p-5 flex flex-col gap-3"><p>The round continues.</p><button autoFocus className={button} onClick={() => setMenu(false)}>Resume</button><button className={button} onClick={() => { gameAudio.setEnabled(muted); setMuted(!muted); }}>{muted ? 'Unmute' : 'Mute'}</button><button className={button} onClick={onLeave}>Leave</button></div>}
    {outcome && <RoundResult outcome={outcome} local={local} />}
  </div>;
}
