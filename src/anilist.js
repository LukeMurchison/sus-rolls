const getCharactersForPulls = async () => {
  const query = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      characters {
        id
        name {
          full
        }
        image {
          large
        }
        age
        siteUrl
        media(perPage: 1, sort: [POPULARITY_DESC]) {
          nodes {
            title {
              romaji
            }
          }
        }
      }
    }
  }
`;

  const getOneCharacter = async () => {
    const page = Math.floor(Math.random() * 100) + 1;
    const variables = { page, perPage: 50 };

    try {
      const response = await axios.post("https://graphql.anilist.co", {
        query,
        variables,
      });

      const characters = response.data.data.Page.characters;
      const randomCharacter =
        characters[Math.floor(Math.random() * characters.length)];

      return randomCharacter;
    } catch (error) {
      console.error("❌ Error fetching one character:", error);
      return null;
    }
  };

  const rolls = await Promise.all([getOneCharacter(), getOneCharacter(), getOneCharacter()]);

  // Filter out any failed fetches
  return rolls.filter(Boolean);
};
