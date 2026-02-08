import { Doctor, Animal, Visit } from "../types/domain";

export const mockDoctors: Doctor[] = [
  {
    id: "1",
    name: "Dr. Ahmed Khan",
    location: "Lahore, Punjab",
  },
];

export const mockAnimals: Animal[] = [
  {
    id: "1",
    owner_name: "Ali Hassan",
    owner_phone: "+92-300-1111111",
    species: "Cattle",
    breed: "Sahiwal",
    tag_id: "TAG-001",
  },
  {
    id: "2",
    owner_name: "Fatima Bibi",
    owner_phone: "+92-300-2222222",
    species: "Goat",
    breed: "Beetal",
    tag_id: "TAG-002",
  },
  {
    id: "3",
    owner_name: "Muhammad Asif",
    owner_phone: "+92-300-3333333",
    species: "Buffalo",
    breed: "Nili-Ravi",
    tag_id: "TAG-003",
  },
];

export const mockVisits: Visit[] = [
  {
    id: "1",
    doctor_id: "1",
    animal_id: "1",
    visit_datetime: "2026-02-08T10:00:00Z",
    chief_complaint: "Fever and loss of appetite",
  },
  {
    id: "2",
    doctor_id: "1",
    animal_id: "2",
    visit_datetime: "2026-02-07T14:30:00Z",
    chief_complaint: "Lameness in left leg",
  },
  {
    id: "3",
    doctor_id: "1",
    animal_id: "3",
    visit_datetime: "2026-02-06T09:15:00Z",
    chief_complaint: "Routine checkup",
  },
  {
    id: "4",
    doctor_id: "1",
    animal_id: "1",
    visit_datetime: "2026-02-05T11:20:00Z",
    chief_complaint: "Follow-up visit",
  },
  {
    id: "5",
    doctor_id: "1",
    animal_id: "2",
    visit_datetime: "2026-02-04T15:45:00Z",
    chief_complaint: "Vaccination",
  },
];

export const getCurrentDoctor = (): Doctor => {
  return mockDoctors[0];
};

export const getAnimals = (): Animal[] => {
  return mockAnimals;
};

export const getAnimalById = (id: string): Animal | undefined => {
  return mockAnimals.find((animal) => animal.id === id);
};

export const getRecentVisits = (limit: number = 5): Visit[] => {
  return [...mockVisits]
    .sort(
      (a, b) =>
        new Date(b.visit_datetime).getTime() -
        new Date(a.visit_datetime).getTime(),
    )
    .slice(0, limit);
};

export const getVisitsByAnimalId = (animalId: string): Visit[] => {
  return mockVisits
    .filter((visit) => visit.animal_id === animalId)
    .sort(
      (a, b) =>
        new Date(b.visit_datetime).getTime() -
        new Date(a.visit_datetime).getTime(),
    );
};

export const getVisitById = (id: string): Visit | undefined => {
  return mockVisits.find((visit) => visit.id === id);
};

export const createAnimal = (animalData: Omit<Animal, "id">): Animal => {
  const newAnimal: Animal = {
    id: String(mockAnimals.length + 1),
    ...animalData,
  };
  mockAnimals.push(newAnimal);
  return newAnimal;
};

export const createVisit = (visitData: Omit<Visit, "id">): Visit => {
  const newVisit: Visit = {
    id: String(mockVisits.length + 1),
    ...visitData,
  };
  mockVisits.push(newVisit);
  return newVisit;
};
