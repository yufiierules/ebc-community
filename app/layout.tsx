import type { Metadata, Viewport } from 'next';
import './globals.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#f5f6f8'};
export const metadata:Metadata={title:'EBC · Ecija Beyblade Community',description:'Tu comunidad. Tu liga. Tu próxima victoria. Organiza ligas y torneos Beyblade en EBC.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
