import clsx from "clsx";
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router";

import { useLogout } from "../features/auth/useLogout";
import { useMe } from "../features/auth/useMe";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    "block rounded-lg px-3 py-2 text-sm font-medium",
    isActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100",
  );

/**
 * 全ページ共通のヘッダー。ゲストには Explore・ログイン・新規登録、
 * ログイン中は My Trees・Trash・Settings・ログアウトを出す（manifests/common.md §4）。スマホではメニューボタンで開閉する。
 */
export function AppHeader() {
  const { user, isLoading } = useMe();
  const logout = useLogout();
  const location = useLocation();
  // スマホのメニューは「開いたときのページ」でだけ開いている扱いにし、移動したら自動で閉じる
  const [menuOpenedAt, setMenuOpenedAt] = useState<string | null>(null);
  const menuOpen = menuOpenedAt === location.pathname;

  const links = (
    <>
      <NavLink to="/explore" className={navLinkClass}>
        Explore
      </NavLink>
      {user ? (
        <>
          <NavLink to="/me" end className={navLinkClass}>
            My Trees
          </NavLink>
          <NavLink to="/trash" className={navLinkClass}>
            Trash
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            Settings
          </NavLink>
        </>
      ) : null}
    </>
  );

  const account = isLoading ? null : user ? (
    <div className="flex items-center gap-2">
      <Link
        to={`/u/${user.username}`}
        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100"
      >
        <Avatar name={user.displayName} url={user.avatarUrl} />
        <span className="text-sm font-medium md:hidden lg:inline">{user.displayName}</span>
      </Link>
      <button
        type="button"
        onClick={() => {
          logout.mutate();
        }}
        disabled={logout.isPending}
        data-testid="logout-button"
        className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Log out
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <NavLink to="/login" className={navLinkClass}>
        Log in
      </NavLink>
      <Link
        to="/signup"
        className="bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-2 text-sm font-medium text-white"
      >
        Sign up
      </Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 md:px-8">
        <Link to="/" className="text-brand-700 flex items-center gap-2 text-lg font-bold">
          <span aria-hidden="true" className="bg-brand-600 inline-block size-3 rounded-full" />
          Highdea Tree
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {links}
        </nav>
        <div className="hidden md:block">{account}</div>
        <button
          type="button"
          className="ml-auto flex size-11 items-center justify-center rounded-lg hover:bg-slate-100 md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => {
            setMenuOpenedAt(menuOpen ? null : location.pathname);
          }}
        >
          <span aria-hidden="true" className="text-xl">
            {menuOpen ? "×" : "☰"}
          </span>
        </button>
      </div>
      {menuOpen && (
        <div id="mobile-menu" className="border-t border-slate-200 px-4 py-3 md:hidden">
          <nav aria-label="Main" className="space-y-1">
            {links}
          </nav>
          <div className="mt-3 border-t border-slate-200 pt-3">{account}</div>
        </div>
      )}
    </header>
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
