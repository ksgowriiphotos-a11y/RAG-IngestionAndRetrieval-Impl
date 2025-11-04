"use client";

import { useRouter } from 'next/navigation';
import React from 'react';

export default function NavButton({ 
  href, 
  children,
  className = "inline-block rounded bg-indigo-600 text-white px-5 py-3 hover:bg-indigo-700"
}: { 
  href: string; 
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className={className}
    >
      {children}
    </button>
  );
}
