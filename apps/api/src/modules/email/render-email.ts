import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

export function renderEmail(element: React.ReactElement): string {
  const markup = renderToStaticMarkup(element);
  return `<!DOCTYPE html>${markup}`;
}
