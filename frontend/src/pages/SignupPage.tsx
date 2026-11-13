// P-02 Sign up
import { Link, useNavigate } from "react-router";

import { AuthCard } from "../features/auth/AuthCard";
import { SignupForm } from "../features/auth/SignupForm";

/** 新規登録ページ。成功するとログイン済みになり、マイツリーへ移動する（manifests/users.md P-02） */
export default function SignupPage() {
  const navigate = useNavigate();
  return (
    <AuthCard
      title="Create your account"
      subtitle="Start a tree from one idea and let it grow."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-brand-700 font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm onSuccess={() => void navigate("/me", { replace: true })} />
    </AuthCard>
  );
}
