export type Doctor = {
  id: string;
  name: string;
  location?: string;
};

export type Animal = {
  id: string;
  owner_name: string;
  owner_phone: string;
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
