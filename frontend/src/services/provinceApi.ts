import axios from "axios";

export interface Province {
  name: string;
  code: number;
}

export interface Ward {
  name: string;
  code: number;
}

const BASE = "https://provinces.open-api.vn/api/v2";

export const getProvinces = async (): Promise<Province[]> =>
  axios.get(`${BASE}/`).then((res) => res.data);

export const getWards = async (provinceCode: number): Promise<Ward[]> =>
  axios
    .get(`${BASE}/p/${provinceCode}?depth=2`)
    .then((res) => res.data.wards);
