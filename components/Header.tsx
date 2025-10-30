import React from 'react';
import { BotIcon } from './icons';

export const Header: React.FC = () => {
  return (
    <header className="text-center">
      <div className="inline-flex items-center bg-gray-800 p-3 rounded-full">
         <BotIcon className="h-8 w-8 text-blue-400" />
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Prompt Reverse Engineer
      </h1>
      <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-500">
        Faça o upload de um arquivo, pasta ou de um projeto inteiro. A IA analisará tudo e criará um resumo amigável e detalhado, perfeito para explicar, refatorar ou documentar seu trabalho.
      </p>
    </header>
  );
};