import { redirect } from 'next/navigation';

export default function Home() {
  // Esto envía al usuario al dashboard nada más entrar a la web
  redirect('/dashboard');
}