import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...props,
});

export const IUpload = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 16V4m0 0 4 4m-4-4-4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>);
export const IText = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 6V4h14v2M12 4v16m-3 0h6" /></svg>);
export const IUndo = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>);
export const IRedo = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></svg>);
export const IEye = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>);
export const IEyeOff = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="m3 3 18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.9 8.6 2 12 2 12s3.5 7 10 7c1.4 0 2.6-.3 3.7-.7" /></svg>);
export const ITrash = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>);
export const ICopy = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>);
export const IUp = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="m6 15 6-6 6 6" /></svg>);
export const IDown = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>);
export const ILock = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
export const IUnlock = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></svg>);
export const IDownload = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 4v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></svg>);
export const IFolder = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>);
export const ISave = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 3h11l3 3v15H5V3Z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></svg>);
export const IPlus = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IX = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const ISpark = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg>);
export const ICenter = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></svg>);
