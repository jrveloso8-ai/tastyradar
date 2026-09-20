'use client';

import React from 'react';
import { ShadowAuditView } from '@/components/shadow-audit/ShadowAuditView';

export default function ShadowAuditPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <ShadowAuditView />
      </div>
    </main>
  );
}
