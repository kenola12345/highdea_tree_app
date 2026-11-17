import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useMatch } from "react-router";

import { useTree } from "../api/tree";
import { useLogout } from "../features/auth/useLogout";
import { useMe } from "../features/auth/useMe";
import { setTheme, useTheme } from "../lib/theme";
import { MoonIcon, PersonIcon, SunIcon } from "./icons";

/**
 * 全ページ共通のヘッダー（manifests/common.md §4）。左にロゴ、中央に「☰ Menu」とライト・ダークの切り替えの黒いピル、
 * 右にアカウントのアイコンと、ツリーのページでは「Edit | View」の切り替え（ゲストは Sign up）。
 * ページへのリンクはすべてメニューの中に入れ、バーはシンプルに保つ。
 */
export function AppHeader() {
  const { user, isLoading } = useMe();
  const location = useLocation();
  // メニューは「開いたときのページ」でだけ開いている扱いにし、ページを移ったら自動で閉じる
  const [menuOpenedAt, setMenuOpenedAt] = useState<string | null>(null);
  const menuOpen = menuOpenedAt === location.pathname;
  const closeMenu = () => {
    setMenuOpenedAt(null);
  };

  return (
    <header className="bg-page/80 sticky top-0 z-40 backdrop-blur">
      {/* スマホは左右に寄せ、PC では中央のピルが画面の真ん中に来るよう3列にする */}
      <div className="flex h-16 items-center justify-between gap-2 px-4 md:grid md:grid-cols-[1fr_auto_1fr] md:px-8">
        <Link
          to="/"
          aria-label="Highdea Tree home"
          className="flex items-center gap-2 justify-self-start"
        >
          <Logo />
          <span className="text-ink hidden text-lg font-extrabold lg:inline">Highdea Tree</span>
        </Link>

        <MenuPill
          open={menuOpen}
          onToggle={() => {
            setMenuOpenedAt(menuOpen ? null : location.pathname);
          }}
          onClose={closeMenu}
          loggedIn={Boolean(user)}
          user={user ?? null}
        />

        <div className="flex items-center gap-2 justify-self-end">
          {isLoading ? null : user ? (
            <Link
              to={`/u/${user.username}`}
              aria-label={`Your profile (${user.displayName})`}
              title={user.displayName}
              className="rounded-full ring-1 ring-slate-200 transition-shadow hover:ring-slate-400"
            >
              <Avatar name={user.displayName} url={user.avatarUrl} />
            </Link>
          ) : (
            <Link
              to="/login"
              aria-label="Log in"
              title="Log in"
              className="text-ink flex size-9 items-center justify-center rounded-full ring-1 ring-slate-200 hover:ring-slate-400"
            >
              <PersonIcon />
            </Link>
          )}
          {!isLoading && !user && (
            <Link
              to="/signup"
              className="bg-ink text-surface rounded-full px-4 py-2 text-sm font-bold"
            >
              Sign up
            </Link>
          )}
          {user && <TreeModeSwitch />}
        </div>
      </div>
    </header>
  );
}

/** 中央の黒いピル: メニューの開閉とテーマの切り替え。メニューはピルの下に開く */
function MenuPill({
  open,
  onToggle,
  onClose,
  loggedIn,
  user,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  loggedIn: boolean;
  user: { username: string; displayName: string } | null;
}) {
  const theme = useTheme();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Esc とメニューの外のクリックで閉じる
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const next = theme === "dark" ? "light" : "dark";
  return (
    <div ref={wrapperRef} className="relative md:justify-self-center">
      <div className="bg-ink text-surface relative z-10 flex items-center gap-1 rounded-full p-1 shadow-md">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="main-menu"
          data-testid="menu-button"
          className="group flex h-9 items-center gap-2 rounded-full pr-3 pl-3 text-sm font-semibold transition-transform duration-150 hover:bg-white/10 active:scale-95 motion-reduce:transition-none dark:hover:bg-black/10"
        >
          <MenuToggleIcon open={open} />
          {/* 「Menu」と「Close」を同じ場所に重ね、開くと上へ入れ替わる（幅は長い方に合う） */}
          <span aria-hidden="true" className="hidden overflow-hidden sm:grid">
            <span
              className={clsx(
                "col-start-1 row-start-1 transition duration-300 ease-[cubic-bezier(.215,.61,.355,1)] motion-reduce:transition-none",
                open ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100",
              )}
            >
              Menu
            </span>
            <span
              className={clsx(
                "col-start-1 row-start-1 transition duration-300 ease-[cubic-bezier(.215,.61,.355,1)] motion-reduce:transition-none",
                open ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
              )}
            >
              Close
            </span>
          </span>
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTheme(next);
          }}
          aria-label={`Switch to ${next} mode`}
          title={`Switch to ${next} mode`}
          data-testid="theme-toggle"
          className="flex size-9 items-center justify-center rounded-full ring-1 ring-white/25 hover:bg-white/10 dark:ring-black/20 dark:hover:bg-black/10"
        >
          {/* key でテーマごとに作り直し、切り替えるたびにアイコンが回って入れ替わる */}
          <span key={theme} className="animate-spin-in">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </span>
        </button>
      </div>

      <MainMenu open={open} loggedIn={loggedIn} user={user} />
    </div>
  );
}

/** 開くときに上から順に少しずつ遅らせて出す（閉じるときは遅らせずに一度に消す） */
const STAGGER = [
  "group-data-[open=true]:delay-[60ms]",
  "group-data-[open=true]:delay-[100ms]",
  "group-data-[open=true]:delay-[140ms]",
  "group-data-[open=true]:delay-[180ms]",
  "group-data-[open=true]:delay-[220ms]",
  "group-data-[open=true]:delay-[260ms]",
  "group-data-[open=true]:delay-[300ms]",
];

/** パネルの中身の1行: 開くと下から少し上がって現れる */
const riseIn = (index: number) =>
  clsx(
    "translate-y-2 opacity-0 transition duration-300 ease-[cubic-bezier(.215,.61,.355,1)] motion-reduce:transition-none",
    "group-data-[open=true]:translate-y-0 group-data-[open=true]:opacity-100",
    STAGGER[Math.min(index, STAGGER.length - 1)],
  );

const menuLinkClass =
  (index: number) =>
  ({ isActive }: { isActive: boolean }) =>
    clsx(
      "block py-1 text-2xl font-bold tracking-tight",
      riseIn(index),
      // V7 のように、今のページだけ濃く、ほかはインクを薄く出す
      isActive ? "text-ink" : "hover:text-ink text-slate-500",
    );

/**
 * メニューのアイコン: 2本の線。開くと線が中央に寄って回り、✕ になる（アイコンを差し替えずに形を変える）
 */
function MenuToggleIcon({ open }: { open: boolean }) {
  const line =
    "absolute left-0.5 h-[1.75px] w-4 rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(.215,.61,.355,1)] motion-reduce:transition-none";
  return (
    <span aria-hidden="true" className="relative block size-5">
      <span
        className={clsx(
          line,
          "top-[6.5px]",
          open ? "translate-y-[3.5px] rotate-45" : "translate-y-0 rotate-0",
        )}
      />
      <span
        className={clsx(
          line,
          "top-[13.5px]",
          open ? "-translate-y-[3.5px] -rotate-45" : "translate-y-0 rotate-0",
        )}
      />
    </span>
  );
}

/**
 * メニューのパネル（manifests/common.md §4）。大きな文字のページへのリンクと、アカウント（プロフィール・ログアウト）。
 * PC ではピルの下の中央、スマホでは左右をページと同じ 16px 空けて画面幅いっぱいに出す。
 */
function MainMenu({
  open,
  loggedIn,
  user,
}: {
  open: boolean;
  loggedIn: boolean;
  user: { username: string; displayName: string } | null;
}) {
  const logout = useLogout();
  const pages = loggedIn
    ? [
        { to: "/explore", label: "Explore" },
        { to: "/me", label: "My Trees", end: true },
        { to: "/trash", label: "Trash" },
        { to: "/settings", label: "Settings" },
      ]
    : [
        { to: "/explore", label: "Explore" },
        { to: "/login", label: "Log in" },
        { to: "/signup", label: "Sign up" },
      ];
  return (
    // 閉じている間も置いたままにして、閉じるときも動きを付ける。閉じている間は操作も読み上げもされない（inert）
    <nav
      id="main-menu"
      aria-label="Main"
      aria-hidden={!open}
      inert={!open}
      data-open={open}
      data-testid="main-menu"
      className={clsx(
        "group bg-surface fixed inset-x-4 top-[4.25rem] origin-top rounded-3xl border border-slate-200 p-6 shadow-xl",
        "md:absolute md:inset-x-auto md:top-[calc(100%+0.5rem)] md:left-1/2 md:w-80 md:-translate-x-1/2",
        // ピルから下へ広がるように: 少し縮めて上にずらした状態から、拡大しながら降りてくる
        "transition duration-300 ease-[cubic-bezier(.215,.61,.355,1)] motion-reduce:transition-none",
        open
          ? "visible translate-y-0 scale-100 opacity-100"
          : "invisible -translate-y-2 scale-95 opacity-0",
      )}
    >
      <p className={clsx("mb-2 text-xs font-semibold text-slate-400", riseIn(0))}>Menu</p>
      {pages.map((page, index) => (
        <NavLink key={page.to} to={page.to} end={page.end} className={menuLinkClass(index + 1)}>
          {page.label}
        </NavLink>
      ))}

      {user && (
        <div className={riseIn(pages.length + 1)}>
          <hr className="my-5 border-slate-200" />
          <p className="mb-2 text-xs font-semibold text-slate-400">Account</p>
          <Link
            to={`/u/${user.username}`}
            className="hover:text-ink block py-1 text-sm font-semibold text-slate-600"
          >
            {user.displayName}
          </Link>
          <button
            type="button"
            onClick={() => {
              logout.mutate();
            }}
            disabled={logout.isPending}
            data-testid="logout-button"
            className="hover:text-ink block py-1 text-sm font-semibold text-slate-600"
          >
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}

/**
 * ツリーのエディタ・ビューアで、自分のツリーなら「Edit | View」を切り替えるピル。
 * ツリーの詳細はページと同じクエリのキャッシュを使うので、余分な通信はない。
 */
function TreeModeSwitch() {
  const editMatch = useMatch("/trees/:id/edit");
  const viewMatch = useMatch("/trees/:id");
  const id = editMatch?.params.id ?? viewMatch?.params.id ?? null;
  if (!id) return null;
  return <TreeModeSwitchFor id={id} editing={Boolean(editMatch)} />;
}

function TreeModeSwitchFor({ id, editing }: { id: string; editing: boolean }) {
  const { data } = useTree(id);
  if (!data?.isOwner) return null;
  const item = (active: boolean) =>
    clsx(
      "rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors",
      active ? "bg-ink text-surface" : "text-slate-500 hover:text-ink",
    );
  return (
    <div
      role="group"
      aria-label="Mode"
      className="bg-surface flex rounded-full p-1 ring-1 ring-slate-200"
    >
      <Link
        to={`/trees/${id}/edit`}
        aria-current={editing ? "page" : undefined}
        data-testid="mode-edit"
        className={item(editing)}
      >
        Edit
      </Link>
      <Link
        to={`/trees/${id}`}
        aria-current={editing ? undefined : "page"}
        title="View as visitor"
        data-testid="mode-view"
        className={item(!editing)}
      >
        View
      </Link>
    </div>
  );
}

/** アバター。URL がなければ表示名の頭文字を出す */
export function Avatar({
  name,
  url,
  size = "sm",
}: {
  name: string;
  url: string | null;
  size?: "sm" | "lg";
}) {
  const sizeClass = size === "lg" ? "size-20 text-2xl" : "size-8 text-sm";
  if (url) {
    return <img src={url} alt="" className={clsx(sizeClass, "rounded-full object-cover")} />;
  }
  return (
    <span
      aria-hidden="true"
      className={clsx(
        sizeClass,
        "bg-brand-100 text-brand-700 flex items-center justify-center rounded-full font-semibold",
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** ロゴ: インクの角丸の四角に、黄色の「H」（アプリ全体で1か所だけの差し色） */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "bg-deep text-sun grid size-8 place-items-center rounded-[10px] text-base leading-none font-black dark:ring-1 dark:ring-white/15",
        className,
      )}
    >
      H
    </span>
  );
}
