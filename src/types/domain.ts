export type Doctor = {
  id: string;
  name: string;
  location?: string;
};

export type FarmerInfo = {
  fullName: string;
  phoneNumber: string;
  nicNo?: string;
  villageName?: string;
};

export type Animal = {
  id: string;
  farmer_id?: number;
  farmer?: FarmerInfo;
  species: string;
  breed?: string;
  tag_id?: string;
};

export type Visit = {
  id: string;
  doctor_id: string;
  animal_id: string;
  visit_datetime: string;
  chief_complaint?: string;
};
