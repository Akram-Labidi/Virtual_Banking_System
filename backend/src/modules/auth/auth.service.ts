import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../database/entities/User.entity';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../../common/enums';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(`Cet email est déjà enregistré`);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = this.userRepo.create({
      email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: UserRole.CLIENT,
    });

    const savedUser = await this.userRepo.save(user);

    await this.auditService.log({
      userId: savedUser.id,
      userRole: savedUser.role,
      action: 'USER_REGISTERED',
      details: `Création de profil (${savedUser.email}, Rôle: ${savedUser.role})`,
      ipAddress,
    });

    const tokens = this.generateTokens(savedUser);
    return {
      user: {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        role: savedUser.role,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: dto.email.toLowerCase().trim() })
      .getOne();

    if (!user) {
      throw new UnauthorizedException(`Identifiants invalides`);
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      await this.auditService.log({
        userId: user.id,
        userRole: user.role,
        action: 'AUTH_FAILED_LOGIN',
        details: `Tentative de connexion avec mot de passe incorrect`,
        ipAddress,
      });
      throw new UnauthorizedException(`Identifiants invalides`);
    }

    if (!user.isActive) {
      throw new UnauthorizedException(`Ce compte utilisateur est suspendu`);
    }

    await this.auditService.log({
      userId: user.id,
      userRole: user.role,
      action: 'AUTH_LOGIN_SUCCESS',
      details: `Connexion réussie`,
      ipAddress,
    });

    const tokens = this.generateTokens(user);
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Session expirée');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Token de rafraîchissement invalide ou expiré');
    }
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '2h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 7200,
    };
  }
}
