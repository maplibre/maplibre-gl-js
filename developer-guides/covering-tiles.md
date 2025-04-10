

$$ r(\theta) = h\tan\theta $$
$$ D(\theta) = h\sec\theta $$

Assume the horizontal field of view is a small angle $\alpha$.

Then the area of an infintesimal strip on the ground is 

$$ dA = \alpha D dr$$

In tile units, the differential area is

$$ dT = S^2dA =  S^2\alpha D dr = S^2\alpha D \frac{dr}{d\theta}d\theta = S^2\alpha Dh \sec ^2\theta d\theta = S^2\alpha h^2 \sec ^3\theta d\theta = S^2\alpha D_c^2 \cos^2 \theta_c \sec ^3\theta d\theta$$

The tile scale factor is given by the formula

$$ S = S_c\frac{D_c}{D}\cos^{b/2}\theta = S_c D_c \frac{\cos^{b/2+1}\theta}{h} = S_c \frac{\cos^{b/2+1}\theta}{\cos\theta_c} $$

where $b$ is the tuning parameter `pitchTileLoadingBehavior`.

Thus the total tile area is 
$$T = \int_{\theta_1}^{\theta2} S_c^2 \frac{\cos^{b+2}\theta}{\cos^2\theta_c}\alpha D_c^2 \cos^2\theta_c \sec ^3\theta d\theta = S_c^2 D_c^2\alpha \int_{\theta_1}^{\theta2} \cos^{b-1}\theta d\theta $$

And the ratio of tile area to tile area at `pitch == 0` is 

$$ \frac{T}{T_0} = \frac{S_c^2 D_c^2\alpha \int_{\theta_1}^{\theta2} \cos^{b-1}\theta d\theta}{S_{c0}^2 D_c^2\alpha \int_{-vFOV/2}^{vFOV/2} \cos^{b-1}\theta d\theta} = \frac{S_c^2}{S_{c0}^2}  \frac{\int_{\theta_1}^{\theta2} \cos^{b-1}\theta d\theta}{\int_{-vFOV/2}^{vFOV/2} \cos^{b-1}\theta d\theta}$$