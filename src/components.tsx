import { ReactNode } from 'react';
export function Badge({children, tone='default'}:{children:ReactNode;tone?:'default'|'green'|'orange'|'blue'}){return <span className={`badge badge-${tone}`}>{children}</span>}
export function SectionTitle({eyebrow,title,action}:{eyebrow?:string;title:string;action?:ReactNode}){return <div className="section-title"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>}
export function EmptyState({title,description}:{title:string;description:string}){return <div className="empty"><div className="empty-icon">✦</div><h3>{title}</h3><p>{description}</p></div>}
