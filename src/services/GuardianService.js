import { Guardian } from "../models/index.js";
import GuardianRepository from "../repositories/GuardianRepository.js";
import { getGuardianFields } from "./fieldDefinitions.js";
import {
  normalizeQueryValues,
  sanitizePagination,
} from "./queryUtils.js";

class GuardianService {
  constructor(guardianRepository) {
    this.guardianRepository = guardianRepository;
  }

  _getFields(editor = true) {
    return getGuardianFields({ editor });
  }

  _parseGuardianRows(rawRows) {
    const guardians = new Map();
    const studentIds = new Map();

    for (const row of rawRows) {
      if (!guardians.has(row.id)) {
        guardians.set(
          row.id,
          new Guardian(
            row.id,
            row.firstName,
            row.lastName,
            row.birthDate,
            row.legalRole,
            row.phone,
            row.address,
            []
          )
        );
        studentIds.set(row.id, new Set());
      }

      if (
        row.assignedStudentId &&
        !studentIds.get(row.id).has(row.assignedStudentId)
      ) {
        guardians.get(row.id).assignedStudents.push({
          id: row.assignedStudentId,
          firstName: row.assignedStudentFirstName,
          lastName: row.assignedStudentLastName,
          birthDate: row.assignedStudentBirthDate,
          birthPlace: row.assignedStudentBirthPlace,
          status: row.assignedStudentStatus,
        });
        studentIds.get(row.id).add(row.assignedStudentId);
      }
    }

    return Array.from(guardians.values());
  }

  getGuardians(periodId = "all", filters = {}, includeStudents = true) {
    const sanitizedFilters = {
      id: normalizeQueryValues(filters.id),
      firstName: normalizeQueryValues(filters.firstName),
      lastName: normalizeQueryValues(filters.lastName),
      dateOfBirth: normalizeQueryValues(
        filters.dateOfBirth ?? filters.birthDate
      ),
      legalRole: normalizeQueryValues(filters.legalRole),
      phone: normalizeQueryValues(filters.phone),
      address: normalizeQueryValues(filters.address),
      q: normalizeQueryValues(filters.q),
      studentId: normalizeQueryValues(filters.studentId),
      studentFirstName: normalizeQueryValues(filters.studentFirstName),
      studentLastName: normalizeQueryValues(filters.studentLastName),
      studentQ: normalizeQueryValues(filters.studentQ),
    };
    const pagination = sanitizePagination(filters);
    const { rows: rawRows, recordsAmount } =
      this.guardianRepository.findAllByPeriod(periodId, {
        filters: sanitizedFilters,
        pagination,
        includeStudents,
      });

    return {
      rows: this._parseGuardianRows(rawRows),
      recordsAmount,
      fields: this._getFields(false),
    };
  }

  getGuardianById(id, periodId = "all", includeStudents = true) {
    if (!this.guardianRepository.findById(id)) {
      const error = new Error("Representante no registrado");
      error.status = 404;
      throw error;
    }

    const { rows } = this.getGuardians(
      periodId,
      { id },
      includeStudents
    );
    const guardian = rows.find((row) => row.id === id);
    if (!guardian) {
      const error = new Error("Representante no registrado en el periodo");
      error.status = 404;
      throw error;
    }

    return {
      guardian,
      fields: this._getFields(),
    };
  }

  createGuardian(guardianData) {
    if (
      !guardianData?.id ||
      !guardianData.firstName ||
      !guardianData.lastName ||
      !guardianData.legalRole
    ) {
      const error = new Error(
        "La cédula, nombres, apellidos y rol legal son requeridos"
      );
      error.status = 400;
      throw error;
    }
    if (this.guardianRepository.findById(guardianData.id)) {
      const error = new Error("Representante ya registrado");
      error.status = 409;
      throw error;
    }

    const guardian = new Guardian(
      guardianData.id,
      guardianData.firstName,
      guardianData.lastName,
      guardianData.birthDate ?? null,
      guardianData.legalRole,
      guardianData.phone ?? null,
      guardianData.address ?? null
    );
    this.guardianRepository.create(guardian);
    return guardian;
  }

  updateGuardian(id, guardianData) {
    const current = this.guardianRepository.findById(id);
    if (!current) {
      const error = new Error("Representante no registrado");
      error.status = 404;
      throw error;
    }

    const guardian = new Guardian(
      id,
      guardianData.firstName ?? current.firstName,
      guardianData.lastName ?? current.lastName,
      guardianData.birthDate ?? current.birthDate,
      guardianData.legalRole ?? current.legalRole,
      guardianData.phone ?? current.phone,
      guardianData.address ?? current.address
    );
    this.guardianRepository.update(id, guardian);
    return guardian;
  }
}

export default new GuardianService(GuardianRepository);
