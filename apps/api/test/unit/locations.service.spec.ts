import { LocationsService } from '../../src/modules/locations/locations.service';

describe('LocationsService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv, APP_ENV: 'test', MAP_PROVIDER: 'amap', MAP_API_KEY: 'test-map-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('puts the reverse-geocoded Chinese address before nearby POIs', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: '1',
          regeocode: {
            formatted_address: '上海市黄浦区人民广场',
            addressComponent: {
              city: [],
              district: '黄浦区',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: '1',
          pois: [
            {
              id: 'poi-1',
              name: '人民公园',
              address: '南京西路231号',
              cityname: '上海市',
              adname: '黄浦区',
              location: '121.4737,31.2304',
            },
          ],
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await new LocationsService().search({
      keyword: '附近地点',
      latitude: 31.2304,
      longitude: 121.4737,
    });

    expect(result.list[0]).toMatchObject({
      name: '上海市黄浦区人民广场',
      address: '上海市黄浦区人民广场',
      district: '黄浦区',
      source: 'amap-regeo',
    });
    expect(result.list[0].name).not.toMatch(/\d+\.\d+\s*,\s*\d+\.\d+/);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/geocode/regeo');
  });

  it('does not return mock locations when map search is disabled in production', async () => {
    const fetchMock = jest.fn();
    process.env = { ...originalEnv, APP_ENV: 'production', MAP_PROVIDER: 'disabled' };
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await new LocationsService().search({
      keyword: '闄勮繎鍦扮偣',
      latitude: 31.2304,
      longitude: 121.4737,
    });

    expect(result).toEqual({ provider: 'disabled', list: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
