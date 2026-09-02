import { AuthorLoader } from '../src/author.loader';

describe('Hidden DataLoader Batch Verification', () => {
  it('executes single IN query for batched author IDs', async () => {
    const loader = new AuthorLoader();
    const mockDb = {
      query: jest.fn().mockResolvedValue([
        { id: '1', name: 'Author One' },
        { id: '2', name: 'Author Two' },
      ]),
    };

    const result = await loader.loadAuthors(['1', '2', '1'], mockDb);

    expect(mockDb.query).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(3);
    expect(result[0]?.name).toBe('Author One');
    expect(result[1]?.name).toBe('Author Two');
    expect(result[2]?.name).toBe('Author One');
  });
});
