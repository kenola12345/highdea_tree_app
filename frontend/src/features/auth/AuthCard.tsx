import type { ReactNode } from "react";

import { PageContainer } from "../../components/PageContainer";

type AuthCardProps = { title: string; subtitle: string; children: ReactNode; footer: ReactNode };

/** ログイン・新規登録ページの共通の枠 */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <PageContainer className="flex justify-center md:py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-center text-sm text-slate-600">{footer}</p>
      </div>
    </PageContainer>
  );
}
