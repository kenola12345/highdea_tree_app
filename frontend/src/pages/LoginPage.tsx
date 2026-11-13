// P-03 Log in
import { Link, useNavigate, useSearchParams } from "react-router";

import { AuthCard } from "../features/auth/AuthCard";
import { LoginForm } from "../features/auth/LoginForm";
import { isSafeNextPath } from "../lib/urls";

/**
 * ログインページ。成功したら ?next= のページ（ログインが必要で送られてきた元の画面）へ、なければ /me へ。
 * next は自サイト内のパスだけ受け付け、外部サイトへ飛ばされないようにする。
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const destination = isSafeNextPath(next) ? next : "/me";

  return (
    <AuthCard
      title="Log in"
      subtitle="Welcome back to Highdea Tree."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="text-brand-700 font-medium hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm onSuccess={() => void navigate(destination, { replace: true })} />
    </AuthCard>
  );
}
