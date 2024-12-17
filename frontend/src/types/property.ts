// types/property.ts

export interface Unit {
    id?: number
    name: string
    type: string
    size: number
    status: string
    rent: number
  }
  
  export interface Property {
    id?: number
    address: string
    size: number
    price: number
    status: string
    units?: Unit[]
  }
  
  export interface PropertyFormData extends Omit<Property, 'id'> {
    units?: Omit<Unit, 'id'>[]
  }