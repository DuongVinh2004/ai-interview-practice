import { AuthorLoader } from '../src/author.loader';

describe('AuthorLoader', () => {
  it('should instantiate and be defined', () => {
    const loader = new AuthorLoader();
    expect(loader).toBeDefined();
  });
});
