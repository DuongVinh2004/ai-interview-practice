export class AuthorLoader {
  async loadAuthors(bookAuthorIds: string[], db: any) {
    // BUG: Iterative SQL query causing N+1
    const results = [];
    for (const id of bookAuthorIds) {
      results.push(await db.query('SELECT * FROM authors WHERE id = ?', id));
    }
    return results;
  }
}
