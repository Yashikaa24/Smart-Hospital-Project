import { create } from 'zustand';

const useStore = create((set) => ({
  role: localStorage.getItem('role') || 'patient',
  hospitalId: localStorage.getItem('hospitalId') || '',
  doctorId: localStorage.getItem('doctorId') || '',
  token: null, // this is the active queue token (ticket info)

  setRole: (role) => {
    localStorage.setItem('role', role);
    set({ role });
  },
  setHospitalId: (id) => {
    localStorage.setItem('hospitalId', id);
    set({ hospitalId: id });
  },
  setDoctorId: (id) => {
    localStorage.setItem('doctorId', id);
    set({ doctorId: id });
  },
  setToken: (token) => set({ token }),
}));

export default useStore;
