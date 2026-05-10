let accessTokenMemory: string | null = null;

export const getAccessToken = () => accessTokenMemory;

export const setAccessTokenMemory = (token: string | null) => {
  accessTokenMemory = token;
};

export const clearAccessTokenMemory = () => {
  accessTokenMemory = null;
};
