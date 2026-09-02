export class AuthorLoader {
  async loadAuthors(bookAuthorIds: string[], db: any) {
    const uniqueIds = Array.from(new Set(bookAuthorIds));
    const authors = await db.query('SELECT * FROM authors WHERE id IN (?)', uniqueIds);
    const authorMap = new Map(authors.map((a: any) => [a.id, a]));
    return bookAuthorIds.map((id: string) => authorMap.get(id));
  }
}
